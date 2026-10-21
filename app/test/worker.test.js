import test from "node:test";
import assert from "node:assert/strict";
import { createPool } from "../src/db.js";
import { createParcels } from "../src/parcels.js";
import { arrivalText, notifyArrivals } from "../src/worker.js";

test("the worker sends arrival SMS outside any database connection and marks parcels notified", async () => {
  const pool = createPool({ max: 2, waitMs: 50 });
  let n = 0;
  const parcels = createParcels({ pool, rng: () => [0.111111, 0.222222][n++ % 2], clock: () => new Date("2026-10-14T09:00:00Z") });
  await parcels.registerParcel({ lockerId: 1, recipientPhone: "+380000000001", sender: "Приклад" });
  await parcels.registerParcel({ lockerId: 4, recipientPhone: "+380000000002", sender: "Приклад" });

  const sent = [];
  const sms = {
    async send(to, text) {
      assert.equal(pool.stats().inUse, 0, "no connection is held while talking to the SMS provider");
      if (to === "+380000000002") throw new Error("TLS handshake timeout to sms.example.net");
      sent.push({ to, text });
    },
  };
  const lines = [];
  const log = { info: (msg, f) => lines.push({ msg, ...f }), error: (msg, f) => lines.push({ msg, ...f }) };

  assert.equal(await notifyArrivals({ pool, sms, log }), 1);
  assert.deepEqual(sent, [{ to: "+380000000001", text: "Посилка чекає у поштоматі №1. Код: 111111" }]);
  assert.deepEqual(lines.map((l) => l.msg), ["sms send failed", "sms batch sent"]);

  // the parcel whose SMS failed is still waiting for a notification
  const left = await pool.withConnection((db) => db.listUnnotified(10));
  assert.deepEqual(left.map((p) => p.recipientPhone), ["+380000000002"]);
  assert.equal(arrivalText({ lockerId: 4, code: "222222" }), "Посилка чекає у поштоматі №4. Код: 222222");
});
