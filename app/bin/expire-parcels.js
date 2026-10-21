#!/usr/bin/env node
// Nightly job (cron on the VM): parcels nobody picked up within 72 hours go back
// to the sender.
import { pathToFileURL } from "node:url";
import { loadConfig } from "../src/config.js";
import { createLogger } from "../src/log.js";
import { createPool } from "../src/db.js";
import { createParcels } from "../src/parcels.js";
import { createCourierClient } from "../src/courier.js";

export async function expireParcels({ parcels, courier, log, now = new Date() }) {
  const expired = await parcels.findExpired(now);
  for (const parcel of expired) {
    await parcels.markReturned(parcel.id, now);
    await courier.requestReturn(parcel);
  }
  log.info("expired parcels returned", { count: expired.length });
  return expired.length;
}

async function main() {
  const config = loadConfig();
  const log = createLogger({ level: config.logLevel });
  const pool = createPool({ max: config.dbPoolMax, waitMs: config.dbPoolWaitMs });
  const parcels = createParcels({ pool });
  const courier = createCourierClient({ baseUrl: config.courierBaseUrl });
  await expireParcels({ parcels, courier, log });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
