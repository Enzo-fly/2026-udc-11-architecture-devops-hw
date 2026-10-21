import test from "node:test";
import assert from "node:assert/strict";
import { loadConfig } from "../src/config.js";

test("with no environment the service starts on local-dev defaults", () => {
  const config = loadConfig({});
  assert.equal(config.port, 8080);
  assert.equal(config.dbPoolMax, 4);
  assert.equal(config.dbPoolWaitMs, 2000);
  assert.equal(config.smsRatePerSec, 5);
  assert.equal(config.logLevel, "info");
});

test("values from the environment win over the defaults", () => {
  const config = loadConfig({
    PORT: "3000",
    DB_POOL_MAX: "20",
    DB_POOL_WAIT_MS: "500",
    SMS_BASE_URL: "https://sms.example.net/api/v2",
    SMS_TOKEN: "CHANGE_ME",
    COURIER_BASE_URL: "https://courier.example.com/api/v1",
  });
  assert.equal(config.port, 3000);
  assert.equal(config.dbPoolMax, 20);
  assert.equal(config.dbPoolWaitMs, 500);
  assert.equal(config.smsBaseUrl, "https://sms.example.net/api/v2");
  assert.equal(config.smsToken, "CHANGE_ME");
  assert.equal(config.courierBaseUrl, "https://courier.example.com/api/v1");
});
