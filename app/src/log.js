// JSON-lines logger: one object per line, timestamp in local time with offset
// (the containers run with TZ=Europe/Kyiv).

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };

export function isoLocal(date) {
  const offsetMin = -date.getTimezoneOffset();
  const sign = offsetMin >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMin);
  const pad = (n) => String(n).padStart(2, "0");
  const shifted = new Date(date.getTime() + offsetMin * 60_000);
  return `${shifted.toISOString().slice(0, 23)}${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

export function createLogger({
  level = "info",
  write = (line) => process.stdout.write(`${line}\n`),
  clock = () => new Date(),
} = {}) {
  const min = LEVELS[level] ?? LEVELS.info;

  function emit(lvl, msg, fields = {}) {
    if (LEVELS[lvl] < min) return;
    write(JSON.stringify({ ts: isoLocal(clock()), level: lvl, msg, ...fields }));
  }

  return {
    debug: (msg, fields) => emit("debug", msg, fields),
    info: (msg, fields) => emit("info", msg, fields),
    warn: (msg, fields) => emit("warn", msg, fields),
    error: (msg, fields) => emit("error", msg, fields),
  };
}
