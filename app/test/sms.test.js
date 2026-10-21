import test from "node:test";
import assert from "node:assert/strict";
import { createSmsClient } from "../src/sms.js";

function fakeFetch(statuses) {
  const calls = [];
  const fetch = async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body) });
    const status = statuses[Math.min(calls.length - 1, statuses.length - 1)];
    return { status, ok: status < 300, json: async () => ({ id: `msg-${calls.length}` }) };
  };
  return { fetch, calls };
}

function recordingLog() {
  const lines = [];
  const at = (level) => (msg, fields) => lines.push({ level, msg, ...fields });
  return { lines, debug: at("debug"), info: at("info"), warn: at("warn"), error: at("error") };
}

test("on 429 the client backs off, logs a warning and retries", async () => {
  const { fetch, calls } = fakeFetch([429, 429, 200]);
  const log = recordingLog();
  const slept = [];
  const sms = createSmsClient({
    baseUrl: "https://sms.example.net/api/v2",
    token: "CHANGE_ME",
    fetch,
    log,
    ratePerSec: 1000,
    sleep: async (ms) => slept.push(ms),
  });

  const result = await sms.send("+380000000001", "Код: 123456");

  assert.deepEqual(result, { id: "msg-3" });
  assert.equal(calls.length, 3);
  assert.equal(calls[0].url, "https://sms.example.net/api/v2/messages");
  assert.deepEqual(
    log.lines.map((l) => [l.level, l.msg, l.attempt, l.retry_in_ms]),
    [
      ["warn", "sms provider rate limited", 1, 400],
      ["warn", "sms provider rate limited", 2, 800],
    ],
  );
  assert.ok(slept.includes(400) && slept.includes(800));
});

test("an error other than 429 is not retried", async () => {
  const { fetch, calls } = fakeFetch([500]);
  const sms = createSmsClient({ baseUrl: "https://sms.example.net/api/v2", token: "CHANGE_ME", fetch, sleep: async () => {} });
  await assert.rejects(sms.send("+380000000001", "x"), /sms provider responded 500/);
  assert.equal(calls.length, 1);
});
