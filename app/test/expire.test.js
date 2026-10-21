import test from "node:test";
import assert from "node:assert/strict";
import { createPool } from "../src/db.js";
import { createParcels } from "../src/parcels.js";
import { expireParcels } from "../bin/expire-parcels.js";

test("the nightly job returns parcels older than 72 hours, and only those", async () => {
  const pool = createPool({ max: 2, waitMs: 50 });
  let now = new Date("2026-10-10T08:00:00Z");
  let n = 0;
  const parcels = createParcels({ pool, clock: () => now, rng: () => [0.1, 0.2, 0.3][n++] });

  const old = await parcels.registerParcel({ lockerId: 1, recipientPhone: "+380000000001", sender: "Приклад" });
  now = new Date("2026-10-12T08:00:00Z");
  await parcels.registerParcel({ lockerId: 2, recipientPhone: "+380000000002", sender: "Приклад" });
  const pickedUp = await parcels.registerParcel({ lockerId: 3, recipientPhone: "+380000000003", sender: "Приклад" });
  await parcels.pickup(pickedUp.code);

  const requested = [];
  const courier = { requestReturn: async (p) => requested.push(p.id) };
  const log = { info() {} };

  const count = await expireParcels({ parcels, courier, log, now: new Date("2026-10-13T09:00:00Z") });

  assert.equal(count, 1);
  assert.deepEqual(requested, [old.id]);
  const rows = await pool.withConnection((db) => db.listParcels());
  assert.deepEqual(rows.map((p) => p.status), ["returned", "waiting", "picked_up"]);
});
