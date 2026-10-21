// Runtime configuration. Every setting comes from an environment variable, read
// explicitly below, so one look at this file tells you what the service expects.

export function loadConfig(env = process.env) {
  return {
    port: Number(env.PORT) || 8080,
    dbUrl: env.DATABASE_URL || "postgres://poshtomat@localhost:5432/poshtomat",
    // sensible default for local dev
    dbPoolMax: Number(env.DB_POOL_MAX) || 4,
    dbPoolWaitMs: Number(env.DB_POOL_WAIT_MS) || 2000,
    smsBaseUrl: env.SMS_BASE_URL || "http://localhost:9001",
    smsToken: env.SMS_TOKEN || "",
    smsRatePerSec: Number(env.SMS_RATE_PER_SEC) || 5,
    courierBaseUrl: env.COURIER_BASE_URL || "http://localhost:9002",
    logLevel: env.LOG_LEVEL || "info",
  };
}
