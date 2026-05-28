// ── Local storage layer ───────────────────────────────────────────────────
// The single source of truth on this device. Every workout set is one entry.
// sync.js mirrors this to the cloud when configured, but the app never *waits*
// on the network to read or write — that's what makes it instant at the gym.

const Storage = (() => {
  const KEY = "strengthlog.entries.v1";

  function readAll() {
    try {
      return JSON.parse(localStorage.getItem(KEY)) || [];
    } catch {
      return [];
    }
  }

  function writeAll(entries) {
    localStorage.setItem(KEY, JSON.stringify(entries));
  }

  // entry shape: { id, exercise, sets, reps, weight, createdAt }
  function add(entry) {
    const entries = readAll();
    const full = {
      id: entry.id || (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random())),
      exercise: entry.exercise,
      sets: Number(entry.sets) || 0,
      reps: Number(entry.reps) || 0,
      weight: Number(entry.weight) || 0,
      createdAt: entry.createdAt || new Date().toISOString(),
    };
    entries.push(full);
    writeAll(entries);
    return full;
  }

  function remove(id) {
    writeAll(readAll().filter((e) => e.id !== id));
  }

  // Merge cloud rows in without creating duplicates (matched by id).
  function upsertMany(rows) {
    const byId = new Map(readAll().map((e) => [e.id, e]));
    for (const r of rows) byId.set(r.id, r);
    const merged = [...byId.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    writeAll(merged);
    return merged;
  }

  return { readAll, add, remove, upsertMany };
})();
