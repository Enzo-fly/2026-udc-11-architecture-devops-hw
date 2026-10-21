import test from "node:test";
import assert from "node:assert/strict";
import { createPool, PoolTimeoutError } from "../src/db.js";

test("a connection goes back to the pool after use, even when the callback throws", async () => {
  const pool = createPool({ max: 2, waitMs: 50 });
  await pool.withConnection(async () => {
    assert.deepEqual(pool.stats(), { inUse: 1, waiting: 0 });
  });
  await assert.rejects(pool.withConnection(async () => {
    throw new Error("boom");
  }), /boom/);
  assert.deepEqual(pool.stats(), { inUse: 0, waiting: 0 });
});

test("a caller that waits longer than waitMs gets PoolTimeoutError", async () => {
  const pool = createPool({ max: 1, waitMs: 20 });
  let release;
  const held = pool.withConnection(() => new Promise((resolve) => (release = resolve)));

  const err = await pool.withConnection(async () => "never").catch((e) => e);
  assert.ok(err instanceof PoolTimeoutError);
  assert.equal(err.message, "db pool wait timeout after 20ms");
  assert.deepEqual(pool.stats(), { inUse: 1, waiting: 0 });

  release();
  await held;
  assert.deepEqual(pool.stats(), { inUse: 0, waiting: 0 });
});
