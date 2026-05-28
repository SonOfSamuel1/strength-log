// ── Cloud sync (Supabase) ─────────────────────────────────────────────────
// This stays dormant until you fill in config.js. When configured, it:
//   1. signs you in (anonymous session, so no password to manage),
//   2. pulls existing rows down into local storage on load,
//   3. pushes each new set up as you save it.
//
// Design choice: local storage is the source of truth; the cloud is a mirror.
// If a push fails (no signal), the set is still saved locally and gets retried
// next time the app loads. You never lose a set to a dropped connection.

const Sync = (() => {
  let client = null;
  let ready = false;

  function isConfigured() {
    return Boolean(CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY);
  }

  async function init() {
    if (!isConfigured()) return false;
    if (!window.supabase) return false;

    client = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

    // Anonymous auth gives every device a stable user id with zero login UX.
    const { data } = await client.auth.getSession();
    if (!data.session) {
      await client.auth.signInAnonymously();
    }
    ready = true;
    return true;
  }

  async function pull() {
    if (!ready) return [];
    const { data, error } = await client
      .from("entries")
      .select("id, exercise, sets, reps, weight, created_at")
      .order("created_at", { ascending: true });
    if (error) {
      console.warn("sync pull failed:", error.message);
      return [];
    }
    // map db snake_case -> app camelCase
    return data.map((r) => ({
      id: r.id,
      exercise: r.exercise,
      sets: r.sets,
      reps: r.reps,
      weight: r.weight,
      createdAt: r.created_at,
    }));
  }

  async function push(entry) {
    if (!ready) return false;
    const { data: userData } = await client.auth.getUser();
    const { error } = await client.from("entries").insert({
      id: entry.id,
      user_id: userData?.user?.id,
      exercise: entry.exercise,
      sets: entry.sets,
      reps: entry.reps,
      weight: entry.weight,
      created_at: entry.createdAt,
    });
    if (error) {
      console.warn("sync push failed:", error.message);
      return false;
    }
    return true;
  }

  async function remove(id) {
    if (!ready) return false;
    const { error } = await client.from("entries").delete().eq("id", id);
    return !error;
  }

  return { init, pull, push, remove, isConfigured, isReady: () => ready };
})();
