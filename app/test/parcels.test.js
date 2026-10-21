import test from "node:test";
import assert from "node:assert/strict";
import { createPool } from "../src/db.js";
import { AccessDenied, createParcels } from "../src/parcels.js";

const clock = () => new Date("2026-10-14T09:00:00Z");

// rng that returns the given values in order, then repeats the last one
function scriptedRng(...values) {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
}

const sample = { lockerId: 3, recipientPhone: "+380000000001", sender: "Магазин «Приклад»" };

test("a registered parcel gets a 6-digit code that no other waiting parcel has", async () => {
  const pool = createPool({ max: 2, waitMs: 50 });
  const parcels = createParcels({ pool, clock, rng: scriptedRng(0.042, 0.042, 0.5) });

  const first = await parcels.registerParcel(sample);
  const second = await parcels.registerParcel({ ...sample, recipientPhone: "+380000000002" });

  assert.equal(first.code, "042000");
  assert.equal(second.code, "500000"); // 042000 was taken, so a new one was drawn
  assert.equal(first.status, "waiting");
});

test("a code opens the cell once; the second try finds nothing", async () => {
  const pool = createPool({ max: 2, waitMs: 50 });
  const parcels = createParcels({ pool, clock, rng: scriptedRng(0.123456) });
  const parcel = await parcels.registerParcel(sample);

  assert.deepEqual(await parcels.pickup(parcel.code), { id: parcel.id, lockerId: 3 });
  assert.equal(await parcels.pickup(parcel.code), null);
  assert.equal(await parcels.pickup("12ab56"), null);
});

test("the admin list is staff-only, without pickup codes and with masked phones", async () => {
  const pool = createPool({ max: 2, waitMs: 50 });
  const parcels = createParcels({ pool, clock, rng: scriptedRng(0.7) });
  await parcels.registerParcel(sample);

  const rows = await parcels.listForAdmin({ id: 9, role: "staff" });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].phone, "+380*****0001");
  assert.equal("code" in rows[0], false);
  await assert.rejects(parcels.listForAdmin({ id: 1, role: "resident" }), AccessDenied);
  await assert.rejects(parcels.listForAdmin(null), AccessDenied);
});
