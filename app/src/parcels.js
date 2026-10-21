export class AccessDenied extends Error {
  constructor() {
    super("access denied");
    this.name = "AccessDenied";
  }
}

export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ValidationError";
  }
}

const STAFF_ROLES = new Set(["staff", "admin"]);

/** A parcel nobody picked up within this time goes back to the sender. */
export const RETURN_AFTER_MS = 72 * 60 * 60 * 1000;

export function maskPhone(phone) {
  return `${phone.slice(0, 4)}${"*".repeat(Math.max(phone.length - 8, 0))}${phone.slice(-4)}`;
}

export function createParcels({ pool, rng = Math.random, clock = () => new Date() }) {
  function newCode(db) {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const code = String(Math.floor(rng() * 1_000_000)).padStart(6, "0");
      if (!db.findWaitingByCode(code)) return code;
    }
    throw new Error("could not allocate a unique pickup code");
  }

  return {
    /** Called by the delivery operator's scanner when a parcel goes into a cell. */
    async registerParcel({ lockerId, recipientPhone, sender } = {}) {
      if (!Number.isInteger(lockerId) || lockerId <= 0) {
        throw new ValidationError("lockerId must be a positive integer");
      }
      if (!/^\+\d{10,15}$/.test(recipientPhone ?? "")) {
        throw new ValidationError("recipientPhone must look like +<10-15 digits>");
      }
      const from = sender.trim();
      return pool.withConnection((db) =>
        db.insertParcel({
          code: newCode(db),
          lockerId,
          recipientPhone,
          sender: from,
          status: "waiting",
          arrivedAt: clock().toISOString(),
          notifiedAt: null,
          pickedUpAt: null,
          returnedAt: null,
        }),
      );
    },

    /** The locker terminal sends the code the person typed; null = no such waiting parcel. */
    async pickup(code) {
      if (!/^\d{6}$/.test(String(code ?? ""))) return null;
      const parcel = await pool.withConnection((db) => db.findWaitingByCode(String(code)));
      if (!parcel) return null;
      const at = clock().toISOString();
      const updated = await pool.withConnection((db) =>
        db.updateParcel(parcel.id, { status: "picked_up", pickedUpAt: at }),
      );
      await pool.withConnection((db) => db.addEvent({ parcelId: parcel.id, type: "picked_up", at }));
      return { id: updated.id, lockerId: updated.lockerId };
    },

    /** Staff-only list: no pickup codes, phone numbers masked. */
    async listForAdmin(user) {
      if (!user || !STAFF_ROLES.has(user.role)) throw new AccessDenied();
      const rows = await pool.withConnection((db) => db.listParcels());
      return rows.map(({ code, recipientPhone, ...rest }) => ({ ...rest, phone: maskPhone(recipientPhone) }));
    },

    async findExpired(now = clock()) {
      const cutoff = now.getTime() - RETURN_AFTER_MS;
      const rows = await pool.withConnection((db) => db.listParcels());
      return rows.filter((p) => p.status === "waiting" && Date.parse(p.arrivedAt) <= cutoff);
    },

    async markReturned(id, now = clock()) {
      return pool.withConnection((db) =>
        db.updateParcel(id, { status: "returned", returnedAt: now.toISOString() }),
      );
    },
  };
}
