import test from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { createPool } from "../src/db.js";
import { createParcels } from "../src/parcels.js";
import { createHandler, sessionAuth } from "../src/server.js";

// The handler is a plain (req, res) function, so tests never open a port.
function fakeReq(method, url, body, headers = {}) {
  const req = Readable.from(body === undefined ? [] : [JSON.stringify(body)]);
  return Object.assign(req, { method, url, headers });
}

async function call(handler, method, url, body, headers) {
  const res = {
    status: 0,
    body: "",
    writeHead(status) {
      this.status = status;
    },
    end(chunk = "") {
      this.body = chunk;
    },
  };
  await handler(fakeReq(method, url, body, headers), res);
  return { status: res.status, json: JSON.parse(res.body) };
}

function setup({ max = 4, waitMs = 50 } = {}) {
  const lines = [];
  const log = {
    debug() {},
    info: (msg, fields) => lines.push({ level: "info", msg, ...fields }),
    warn: (msg, fields) => lines.push({ level: "warn", msg, ...fields }),
    error: (msg, fields) => lines.push({ level: "error", msg, ...fields }),
  };
  const pool = createPool({ max, waitMs });
  const parcels = createParcels({ pool, rng: () => 0.314159, clock: () => new Date("2026-10-14T09:00:00Z") });
  const handler = createHandler({ parcels, authenticate: sessionAuth(pool), log, version: "9.9.9" });
  return { handler, pool, lines };
}

test("register a parcel, then pick it up with its code", async () => {
  const { handler } = setup();
  const created = await call(handler, "POST", "/parcels", {
    lockerId: 2,
    recipientPhone: "+380000000003",
    sender: "Книгарня «Приклад»",
  });
  assert.equal(created.status, 201);
  assert.deepEqual(created.json, { id: 1, lockerId: 2, status: "waiting" });

  assert.deepEqual(await call(handler, "POST", "/pickup", { code: "314159" }), {
    status: 200,
    json: { id: 1, lockerId: 2 },
  });
  assert.equal((await call(handler, "POST", "/pickup", { code: "314159" })).status, 404);
});

test("the admin list needs a staff session", async () => {
  const { handler, pool } = setup();
  await pool.withConnection(async (db) => {
    db.addSession("session-staff-1", { id: 7, role: "staff" });
    db.addSession("session-resident-1", { id: 8, role: "resident" });
  });

  assert.equal((await call(handler, "GET", "/admin/parcels")).status, 403);
  const asResident = await call(handler, "GET", "/admin/parcels", undefined, { authorization: "Bearer session-resident-1" });
  assert.equal(asResident.status, 403);
  const asStaff = await call(handler, "GET", "/admin/parcels", undefined, { authorization: "Bearer session-staff-1" });
  assert.deepEqual(asStaff, { status: 200, json: { parcels: [] } });
});

test("when no database connection frees up in time the API answers 503 and logs it", async () => {
  const { handler, pool, lines } = setup({ max: 1, waitMs: 20 });
  let release;
  const held = pool.withConnection(() => new Promise((resolve) => (release = resolve)));

  const res = await call(handler, "POST", "/pickup", { code: "123456" });
  release();
  await held;

  assert.deepEqual(res, { status: 503, json: { error: "service busy, try again" } });
  assert.equal(lines.length, 1);
  assert.equal(lines[0].level, "error");
  assert.equal(lines[0].msg, "request failed");
  assert.equal(lines[0].status, 503);
  assert.equal(lines[0].error, "db pool wait timeout after 20ms");
});

test("health answers without touching the database; unknown routes are 404", async () => {
  const { handler } = setup({ max: 0, waitMs: 5 }); // a pool with no connections at all
  assert.deepEqual(await call(handler, "GET", "/health"), { status: 200, json: { status: "ok", version: "9.9.9" } });
  assert.equal((await call(handler, "GET", "/nope")).status, 404);
  assert.equal((await call(handler, "POST", "/parcels", { lockerId: "x" })).status, 400);
});
