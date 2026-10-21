// Client for the SMS provider's HTTP API.

const silent = { debug() {}, info() {}, warn() {}, error() {} };
const realSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function createSmsClient({
  baseUrl,
  token,
  fetch = globalThis.fetch,
  ratePerSec = 5,
  log = silent,
  sleep = realSleep,
  now = Date.now,
  maxAttempts = 4,
  backoffMs = 400,
}) {
  const gapMs = 1000 / ratePerSec;
  let nextAt = 0;

  // Space the requests out to at most `ratePerSec` per second.
  async function pace() {
    const t = now();
    if (nextAt > t) await sleep(nextAt - t);
    nextAt = Math.max(t, nextAt) + gapMs;
  }

  return {
    async send(to, text) {
      for (let attempt = 1; ; attempt += 1) {
        await pace();
        const res = await fetch(`${baseUrl}/messages`, {
          method: "POST",
          headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
          body: JSON.stringify({ to, text }),
        });
        if (res.status === 429 && attempt < maxAttempts) {
          const retryInMs = backoffMs * 2 ** (attempt - 1);
          log.warn("sms provider rate limited", { status: 429, attempt, retry_in_ms: retryInMs });
          await sleep(retryInMs);
          continue;
        }
        if (!res.ok) throw new Error(`sms provider responded ${res.status}`);
        return res.json();
      }
    },
  };
}
