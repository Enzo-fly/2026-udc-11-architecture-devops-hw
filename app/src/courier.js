// Client for the courier company's returns API.

export function createCourierClient({ baseUrl, fetch = globalThis.fetch }) {
  return {
    /** Ask the courier to collect a parcel from its cell and take it back to the sender. */
    async requestReturn(parcel) {
      const res = await fetch(`${baseUrl}/returns`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          parcel_id: parcel.id,
          locker_id: parcel.lockerId,
          sender: parcel.sender,
          reason: "not_picked_up_72h",
        }),
      });
      if (!res.ok) throw new Error(`courier API responded ${res.status}`);
      return res.json();
    },
  };
}
