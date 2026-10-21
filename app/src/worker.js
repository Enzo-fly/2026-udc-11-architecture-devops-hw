import { pathToFileURL } from "node:url";
import { loadConfig } from "./config.js";
import { createLogger } from "./log.js";
import { createPool } from "./db.js";
import { createSmsClient } from "./sms.js";
import { VERSION } from "./version.js";

export const POLL_INTERVAL_MS = 10_000;
export const BATCH_SIZE = 50;

export function arrivalText(parcel) {
  return `Посилка чекає у поштоматі №${parcel.lockerId}. Код: ${parcel.code}`;
}

function describeError(err) {
  return err?.cause?.message ?? err?.message ?? String(err);
}

/**
 * One polling round. The batch is read inside a connection, the connection goes
 * back to the pool, and only then do the SMS calls start.
 */
export async function notifyArrivals({ pool, sms, log, clock = () => new Date(), batchSize = BATCH_SIZE }) {
  const batch = await pool.withConnection((db) => db.listUnnotified(batchSize));
  let sent = 0;
  for (const parcel of batch) {
    try {
      await sms.send(parcel.recipientPhone, arrivalText(parcel));
    } catch (err) {
      log.error("sms send failed", { parcel_id: parcel.id, error: describeError(err) });
      continue; // stays unnotified, the next round tries again
    }
    await pool.withConnection((db) => db.updateParcel(parcel.id, { notifiedAt: clock().toISOString() }));
    sent += 1;
  }
  if (sent > 0) log.info("sms batch sent", { count: sent });
  return sent;
}

async function main() {
  const config = loadConfig();
  const log = createLogger({ level: config.logLevel });
  const pool = createPool({ max: config.dbPoolMax, waitMs: config.dbPoolWaitMs });
  const sms = createSmsClient({
    baseUrl: config.smsBaseUrl,
    token: config.smsToken,
    ratePerSec: config.smsRatePerSec,
    log,
  });

  let stopping = false;
  process.on("SIGTERM", () => {
    log.info("shutting down", { signal: "SIGTERM" });
    stopping = true;
  });

  log.info("worker started", { version: VERSION });
  while (!stopping) {
    let sent = 0;
    try {
      sent = await notifyArrivals({ pool, sms, log });
    } catch (err) {
      log.error("notify round failed", { error: describeError(err) });
    }
    // a full batch means more are waiting: go again right away, otherwise wait
    if (sent < BATCH_SIZE) await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
