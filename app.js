// ── App wiring ────────────────────────────────────────────────────────────
// Connects voice -> parser -> confirm card -> storage -> screen.

(() => {
  const $ = (id) => document.getElementById(id);
  const micBtn = $("mic-btn");
  const heard = $("heard");
  const card = $("confirm-card");
  const fEx = $("f-exercise");
  const fSets = $("f-sets");
  const fReps = $("f-reps");
  const fWeight = $("f-weight");

  // ── Voice recognition ────────────────────────────────────────────────
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognition = null;
  let listening = false;

  if (SR) {
    recognition = new SR();
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.continuous = false;

    recognition.onresult = (event) => {
      let transcript = "";
      for (const result of event.results) transcript += result[0].transcript;
      heard.textContent = `"${transcript}"`;
      if (event.results[event.results.length - 1].isFinal) {
        handleTranscript(transcript);
      }
    };
    recognition.onerror = (e) => {
      heard.textContent = e.error === "no-speech" ? "Didn't catch that — try again." : "Mic error: " + e.error;
      stopListening();
    };
    recognition.onend = () => stopListening();
  } else {
    micBtn.querySelector(".mic-label").textContent = "Voice not supported — tap to add";
  }

  function startListening() {
    if (!recognition) return openCard(null);
    try {
      recognition.start();
      listening = true;
      micBtn.classList.add("listening");
      micBtn.querySelector(".mic-label").textContent = "Listening… tap to stop";
      heard.textContent = "";
    } catch { /* already started */ }
  }
  function stopListening() {
    listening = false;
    micBtn.classList.remove("listening");
    micBtn.querySelector(".mic-label").textContent = "Tap & speak your set";
    if (recognition) try { recognition.stop(); } catch {}
  }

  micBtn.addEventListener("click", () => (listening ? stopListening() : startListening()));

  // ── Voice -> parser -> card ──────────────────────────────────────────
  function handleTranscript(transcript) {
    const parsed = Parser.parseWorkout(transcript); // <-- YOU implement this in parser.js
    openCard(parsed);
  }

  // ── Confirm card ─────────────────────────────────────────────────────
  function openCard(parsed) {
    fEx.value = parsed?.exercise ?? "";
    fSets.value = parsed?.sets ?? "";
    fReps.value = parsed?.reps ?? "";
    fWeight.value = parsed?.weight ?? "";
    card.hidden = false;
    if (!parsed?.exercise) fEx.focus();
    card.scrollIntoView({ behavior: "smooth", block: "center" });
  }
  function closeCard() {
    card.hidden = true;
    heard.textContent = "";
  }

  $("manual-btn").addEventListener("click", () => openCard(null));
  $("cancel-btn").addEventListener("click", closeCard);

  $("save-btn").addEventListener("click", async () => {
    const exercise = fEx.value.trim();
    if (!exercise) { fEx.focus(); return; }
    const entry = Storage.add({
      exercise,
      sets: fSets.value,
      reps: fReps.value,
      weight: fWeight.value,
    });
    closeCard();
    render();
    if (Sync.isReady()) {
      Sync.push(entry).then((ok) => ok && setSyncStatus("synced", "Synced"));
    }
  });

  // ── Rendering ────────────────────────────────────────────────────────
  function isToday(iso) {
    const d = new Date(iso);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  }
  function volumeOf(e) { return e.sets * e.reps * e.weight; }
  function fmtTime(iso) {
    return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  function fmtDay(iso) {
    return new Date(iso).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
  }

  function entryNode(e) {
    const li = document.createElement("li");
    li.className = "entry";
    const vol = volumeOf(e);
    li.innerHTML = `
      <div class="entry-main">
        <span class="entry-exercise">${escapeHtml(e.exercise)}</span>
        <span class="entry-detail">${e.sets} × ${e.reps} @ ${e.weight} lbs</span>
      </div>
      <div class="entry-meta">
        <div class="entry-volume">${vol.toLocaleString()} lbs</div>
        <div class="entry-time">${fmtTime(e.createdAt)}</div>
      </div>
      <button class="entry-delete" aria-label="Delete">×</button>`;
    li.querySelector(".entry-delete").addEventListener("click", () => {
      Storage.remove(e.id);
      Sync.remove(e.id);
      render();
    });
    return li;
  }

  function render() {
    const all = Storage.readAll().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const today = all.filter((e) => isToday(e.createdAt));
    const older = all.filter((e) => !isToday(e.createdAt));

    const todayList = $("today-list");
    todayList.innerHTML = "";
    today.forEach((e) => todayList.appendChild(entryNode(e)));
    $("empty-today").style.display = today.length ? "none" : "block";

    const totalVol = today.reduce((sum, e) => sum + volumeOf(e), 0);
    $("today-volume").textContent = `${totalVol.toLocaleString()} lbs total`;

    const histList = $("history-list");
    histList.innerHTML = "";
    let lastDay = "";
    older.forEach((e) => {
      const day = fmtDay(e.createdAt);
      if (day !== lastDay) {
        const h = document.createElement("li");
        h.className = "day-header";
        h.textContent = day;
        histList.appendChild(h);
        lastDay = day;
      }
      histList.appendChild(entryNode(e));
    });
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function setSyncStatus(state, text) {
    const el = $("sync-status");
    el.dataset.state = state;
    el.textContent = text;
  }

  // ── Boot ─────────────────────────────────────────────────────────────
  async function boot() {
    render();
    if (Sync.isConfigured()) {
      setSyncStatus("local", "Connecting…");
      const ok = await Sync.init();
      if (ok) {
        const rows = await Sync.pull();
        if (rows.length) { Storage.upsertMany(rows); render(); }
        setSyncStatus("synced", "Synced across devices");
      } else {
        setSyncStatus("error", "Sync offline — saved on device");
      }
    }
  }

  boot();
})();
