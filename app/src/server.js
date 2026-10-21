import http from "node:http";
import { pathToFileURL } from "node:url";
import { loadConfig } from "./config.js";
import { createLogger } from "./log.js";
import { createPool, PoolTimeoutError } from "./db.js";
import { AccessDenied, createParcels, ValidationError } from "./parcels.js";
import { VERSION } from "./version.js";

// Every 5xx is logged. Everything else is logged 1 in ACCESS_LOG_EVERY requests,
// otherwise the access log alone would be most of the disk on a busy day.
export const ACCESS_LOG_EVERY = 100;

/** Staff sessions: `Authorization: Bearer <session id>` looked up in the database. */
export function sessionAuth(pool) {
  return async (req) => {
    const match = /^Bearer (\S+)$/.exec(req.headers?.authorization ?? "");
    if (!match) return null;
    return pool.withConnection((db) => db.findSession(match[1]));
  };
}

async function readJson(req) {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw new ValidationError("body must be JSON");
  }
}

export function createHandler({ parcels, authenticate, log, version = VERSION, now = () => performance.now() }) {
  let seen = 0;

  async function route(method, path, req) {
    if (method === "GET" && path === "/health") return [200, { status: "ok", version }];
    if (method === "POST" && path === "/parcels") {
      const parcel = await parcels.registerParcel(await readJson(req));
      return [201, { id: parcel.id, lockerId: parcel.lockerId, status: parcel.status }];
    }
    if (method === "POST" && path === "/pickup") {
      const { code } = await readJson(req);
      const result = await parcels.pickup(code);
      return result ? [200, result] : [404, { error: "unknown or already used code" }];
    }
    if (method === "GET" && path === "/admin/parcels") {
      const user = await authenticate(req);
      return [200, { parcels: await parcels.listForAdmin(user) }];
    }
    return [404, { error: "not found" }];
  }

  return async function handler(req, res) {
    const started = now();
    const method = req.method;
    const path = new URL(req.url, "http://localhost").pathname;
    let status;
    let body;
    let failure = null;
    try {
      [status, body] = await route(method, path, req);
    } catch (err) {
      failure = err;
      if (err instanceof PoolTimeoutError) [status, body] = [503, { error: "service busy, try again" }];
      else if (err instanceof AccessDenied) [status, body] = [403, { error: "forbidden" }];
      else if (err instanceof ValidationError) [status, body] = [400, { error: err.message }];
      else [status, body] = [500, { error: "internal error" }];
    }
    res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(body));

    const fields = { method, path, status, ms: Math.round(now() - started) };
    if (status >= 500) log.error("request failed", { ...fields, error: failure?.message });
    else if (path !== "/health" && ++seen % ACCESS_LOG_EVERY === 0) log.info("request", fields);
  };
}

function watchHeap(log) {
  const timer = setInterval(() => {
    const { heapUsed, heapTotal } = process.memoryUsage();
    const pct = Math.round((heapUsed / heapTotal) * 100);
    if (pct >= 75) log.warn("heap usage high", { heap_used_pct: pct });
  }, 60_000);
  timer.unref();
}

function main() {
  const config = loadConfig();
  const log = createLogger({ level: config.logLevel });
  const pool = createPool({ max: config.dbPoolMax, waitMs: config.dbPoolWaitMs });
  const parcels = createParcels({ pool });
  const server = http.createServer(createHandler({ parcels, authenticate: sessionAuth(pool), log }));

  server.listen(config.port, () => log.info("service started", { version: VERSION }));
  watchHeap(log);
  process.on("SIGTERM", () => {
    log.info("shutting down", { signal: "SIGTERM" });
    server.close(() => process.exit(0));
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
