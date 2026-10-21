// Data access. In production the same interface sits on PostgreSQL; here the
// store lives in memory, so tests and local runs need nothing installed.

export class PoolTimeoutError extends Error {
  constructor(waitMs) {
    super(`db pool wait timeout after ${waitMs}ms`);
    this.name = "PoolTimeoutError";
  }
}

export function createStore() {
  const parcels = [];
  const events = [];
  const sessions = new Map();
  let nextId = 1;

  const copy = (row) => (row ? { ...row } : null);

  return {
    insertParcel(fields) {
      const row = { id: nextId++, ...fields };
      parcels.push(row);
      return copy(row);
    },
    findParcel(id) {
      return copy(parcels.find((p) => p.id === id));
    },
    findWaitingByCode(code) {
      return copy(parcels.find((p) => p.status === "waiting" && p.code === code));
    },
    updateParcel(id, patch) {
      const row = parcels.find((p) => p.id === id);
      if (!row) return null;
      Object.assign(row, patch);
      return copy(row);
    },
    listParcels() {
      return parcels.map(copy);
    },
    listUnnotified(limit) {
      return parcels
        .filter((p) => p.status === "waiting" && !p.notifiedAt)
        .slice(0, limit)
        .map(copy);
    },
    addEvent(event) {
      events.push({ ...event });
    },
    listEvents() {
      return events.map(copy);
    },
    addSession(token, user) {
      sessions.set(token, { ...user });
    },
    findSession(token) {
      return copy(sessions.get(token));
    },
  };
}

// A connection pool: at most `max` callers hold a connection at once; the rest
// queue, and a caller that waits longer than `waitMs` gets PoolTimeoutError.
export function createPool({ max, waitMs, store = createStore() }) {
  let inUse = 0;
  const waiting = [];

  function acquire() {
    if (inUse < max) {
      inUse += 1;
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      const waiter = { resolve, timer: null };
      waiter.timer = setTimeout(() => {
        const i = waiting.indexOf(waiter);
        if (i !== -1) waiting.splice(i, 1);
        reject(new PoolTimeoutError(waitMs));
      }, waitMs);
      waiting.push(waiter);
    });
  }

  function release() {
    const next = waiting.shift();
    if (next) {
      clearTimeout(next.timer);
      next.resolve(); // the connection goes straight to the next caller
    } else {
      inUse -= 1;
    }
  }

  return {
    async withConnection(fn) {
      await acquire();
      try {
        return await fn(store);
      } finally {
        release();
      }
    },
    stats() {
      return { inUse, waiting: waiting.length };
    },
  };
}
