// ── Voice parser ──────────────────────────────────────────────────────────
// Turns one spoken sentence into a structured set.
//
//   IN:  "Bench press 3 sets of 10 reps at 135 pounds"
//   OUT: { exercise: "bench press", sets: 3, reps: 10, weight: 135 }
//
// This is the brain of the app and it's YOURS to write. There are several
// valid strategies and the one you pick changes how forgiving the app feels:
//
//   • Keyword anchoring (recommended): find the number that sits next to
//     "set(s)", "rep(s)", and "pound(s)/lb(s)". Robust to word order, e.g.
//     "135 pounds, 3 sets of 10" still works.
//   • Positional: assume the order is always exercise → sets → reps → weight.
//     Simpler, but breaks the moment you speak it differently.
//
// Trade-off to weigh: how strict should you be? If reps is missing, do you
// return null (force a re-speak) or return what you got and let the confirm
// card fill the rest? The confirm card already lets the user fix anything,
// so being lenient = fewer re-speaks at the gym.

const Parser = (() => {
  // Speech usually returns digits ("3"), but sometimes words ("three").
  // This map lets you handle both. Use it if you want word support.
  const WORDS = {
    zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
    eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, fifteen: 15, twenty: 20,
  };

  // Helper: pull the number that appears right before a keyword.
  // e.g. numberBefore(text, /reps?/)  on "10 reps"  ->  10
  // Returns null if not found. Handles both "10" and "ten".
  function numberBefore(text, keywordRegex) {
    const re = new RegExp(`(\\d+(?:\\.\\d+)?|[a-z]+)\\s+(?:${keywordRegex.source})`, "i");
    const m = text.match(re);
    if (!m) return null;
    const token = m[1].toLowerCase();
    if (/^\d/.test(token)) return Number(token);
    return token in WORDS ? WORDS[token] : null;
  }

  function parseWorkout(transcript) {
    if (!transcript) return null;
    const text = transcript.toLowerCase().trim();

    const sets = numberBefore(text, /sets?/);
    let reps = numberBefore(text, /reps?/);
    const weight = numberBefore(text, /(?:pounds?|lbs?)/);

    // "3 sets of 10" — natural phrasing where the number AFTER "sets of"
    // is the reps and no "reps" keyword is spoken. Only used as a fallback.
    if (reps === null) {
      const m = text.match(/sets?\s+of\s+(\d+|[a-z]+)/i);
      if (m) {
        const tok = m[1].toLowerCase();
        reps = /^\d/.test(tok) ? Number(tok) : (tok in WORDS ? WORDS[tok] : null);
      }
    }

    // Exercise = words before the first number, with trailing filler trimmed.
    let exercise = text.split(/\d|\b(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty)\b/)[0].trim();
    exercise = exercise.replace(/\b(?:for|of|at|with|x)\b\s*$/i, "").trim();

    // Lenient: return whatever we found; the confirm card fills any gaps.
    return { exercise, sets, reps, weight };
  }

  return { parseWorkout, numberBefore, WORDS };
})();
