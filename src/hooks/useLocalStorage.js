import { useState, useEffect, useRef, useCallback } from "react";

const SUPABASE_URL = 'https://qzvxnklyeadbroesccxt.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6dnhua2x5ZWFkYnJvZXNjY3h0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNTI5MTgsImV4cCI6MjA5MDcyODkxOH0.nDa1iuZwS0E2j-rGizIvVuPRslYn7ugChPJiW-ejSMM';
const HEADERS = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=minimal',
};

function getGymId() {
  try { return localStorage.getItem("hf_gym_id") || "default"; } catch { return "default"; }
}

// Keys that are local-only (never stored in Supabase per-gym)
const LOCAL_ONLY_KEYS = new Set(["hf_theme", "hf_gym_id", "hf_session"]);

// Keys that live in __super__ context
const SUPER_KEYS = new Set(["hf_gyms_registry", "hf_master_exercises", "hf_users", "hf_feedback"]);

function resolveDefault(defaultValue) {
  return typeof defaultValue === 'function' ? defaultValue() : defaultValue;
}

// A1: some legacy writers double-stringified values into the JSONB column.
// If a cloud value is a string that parses to an object/array, heal it.
export function healValue(v) {
  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v);
      if (parsed && typeof parsed === "object") return parsed;
    } catch {}
  }
  return v;
}

/* ── A3: shared poller ─────────────────────────────────────────
   One module-level interval fetches every row for the current gym
   in a single request and fans values out to registered hook
   instances, so data refreshes after mount (chat, bookings,
   stations, feature toggles) without a full reload. */
const pollRegistry = new Set();
let pollerStarted = false;

async function runPoll() {
  try {
    if (pollRegistry.size === 0) return;
    // Skip network while the tab is backgrounded — saves cost + battery.
    // The visibilitychange listener re-runs a fresh poll the moment we're
    // visible again, so no data goes stale while hidden.
    if (typeof document !== "undefined" && document.hidden) return;
    const gymId = getGymId();
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/data_store?select=key,value&gym_id=eq.${encodeURIComponent(gymId)}`,
      { headers: HEADERS }
    );
    if (!res.ok) return;
    const rows = await res.json();
    if (!Array.isArray(rows)) return;
    const byKey = new Map(rows.map(r => [r.key, r.value]));
    pollRegistry.forEach(entry => {
      try {
        if (entry.gymId !== gymId) return; // instance mounted under a different gym
        if (!byKey.has(entry.key)) return; // keys absent from response left untouched
        entry.receive(healValue(byKey.get(entry.key)));
      } catch {}
    });
  } catch {}
}

function ensurePoller() {
  if (pollerStarted) return;
  pollerStarted = true;
  setInterval(runPoll, 20000);
  setTimeout(runPoll, 2000); // one early run shortly after first registration
  try {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") runPoll();
    });
  } catch {}
}

/* ══════════════════════════════════════════════════════════════
   useLocalStorage — Supabase is the source of truth

   Flow:
   1. Initialize with localStorage cache for instant render
   2. ALWAYS fetch from Supabase on mount → overwrite local state
   3. User writes go to Supabase FIRST, then update local state on success
   4. localStorage is just a read cache — never the authority
   ══════════════════════════════════════════════════════════════ */

export function useLocalStorage(key, defaultValue) {
  // Step 1: Initial render uses localStorage cache (fast, might be stale)
  const [value, setValue] = useState(() => {
    try {
      const cached = localStorage.getItem(key);
      if (cached !== null) return JSON.parse(cached);
    } catch {}
    return resolveDefault(defaultValue);
  });

  const [cloudLoaded, setCloudLoaded] = useState(false);
  const fetchedRef = useRef(false);
  const dead = useRef(false);
  const gymIdRef = useRef(getGymId());
  const pendingWrite = useRef(null);
  const dirtyRef = useRef(false);      // A2: user wrote before mount fetch resolved
  const lastWriteAt = useRef(0);       // A3: poller skips instances that wrote recently
  const valueRef = useRef(value);      // A3: last-known value for change comparison

  useEffect(() => { valueRef.current = value; }, [value]);

  // Step 2: ALWAYS fetch from Supabase on mount — cloud is truth
  useEffect(() => {
    dead.current = false;
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    gymIdRef.current = getGymId();

    if (LOCAL_ONLY_KEYS.has(key)) {
      setCloudLoaded(true);
      return;
    }

    const gymId = gymIdRef.current;
    // Don't fetch gym-specific data when in super admin context (and vice versa)
    const shouldFetch = gymId === "__super__" ? SUPER_KEYS.has(key) : !SUPER_KEYS.has(key) || key === "hf_session" || key === "hf_users";

    if (!shouldFetch) {
      setCloudLoaded(true);
      return;
    }

    (async () => {
      try {
        const res = await fetch(
          `${SUPABASE_URL}/rest/v1/data_store?select=value&gym_id=eq.${encodeURIComponent(gymId)}&key=eq.${encodeURIComponent(key)}`,
          { headers: HEADERS }
        );
        if (dead.current) return;
        // A2: if the user already wrote locally, don't clobber it — the
        // pending debounced write will push local → cloud instead.
        if (res.ok && !dirtyRef.current) {
          const rows = await res.json();
          if (rows.length > 0 && rows[0].value !== null) {
            // Cloud has data — this is the truth (heal double-stringified rows)
            const cloudVal = healValue(rows[0].value);
            setValue(cloudVal);
            try { localStorage.setItem(key, JSON.stringify(cloudVal)); } catch {}
          } else {
            // Cloud has no data — use default, clear stale cache
            const def = resolveDefault(defaultValue);
            setValue(def);
            try { localStorage.setItem(key, JSON.stringify(def)); } catch {}
          }
        }
      } catch {
        // Network error — keep using cached value, that's fine
      }
      if (!dead.current) setCloudLoaded(true);
    })();

    return () => { dead.current = true; };
  }, [key]);

  // A3: register this instance with the shared poller
  useEffect(() => {
    if (LOCAL_ONLY_KEYS.has(key)) return;
    const gymId = gymIdRef.current;
    const shouldPoll = gymId === "__super__" ? SUPER_KEYS.has(key) : !SUPER_KEYS.has(key) || key === "hf_users";
    if (!shouldPoll) return;
    const entry = {
      key,
      gymId, // mount-time gym — poller skips this entry if the active gym changed
      receive: (cloudVal) => {
        try {
          if (dead.current) return;
          if (cloudVal === null || cloudVal === undefined) return;
          if (pendingWrite.current) return; // dirty debounced write pending
          if (Date.now() - lastWriteAt.current < 3000) return; // wrote very recently
          const json = JSON.stringify(cloudVal);
          if (json === JSON.stringify(valueRef.current)) return;
          valueRef.current = cloudVal;
          setValue(cloudVal);
          try { localStorage.setItem(key, json); } catch {}
        } catch {}
      },
    };
    pollRegistry.add(entry);
    ensurePoller();
    return () => { pollRegistry.delete(entry); };
  }, [key]);

  // Step 3: Write function — writes to Supabase first, then updates local state
  const setValueAndSync = useCallback((newValOrFn) => {
    if (dead.current) return;
    dirtyRef.current = true;
    lastWriteAt.current = Date.now();

    setValue(prev => {
      const newVal = typeof newValOrFn === 'function' ? newValOrFn(prev) : newValOrFn;

      // Update localStorage cache immediately (optimistic)
      try { localStorage.setItem(key, JSON.stringify(newVal)); } catch {}

      // Skip Supabase for local-only keys
      if (LOCAL_ONLY_KEYS.has(key)) return newVal;

      const gymId = getGymId();
      // Don't write gym data to __super__ or vice versa
      if (gymId === "__super__" && !SUPER_KEYS.has(key)) return newVal;

      // Debounce Supabase writes
      if (pendingWrite.current) clearTimeout(pendingWrite.current);
      pendingWrite.current = setTimeout(async () => {
        pendingWrite.current = null;
        if (dead.current) return;
        const currentGym = getGymId();
        if (currentGym !== gymId) return; // Gym changed, abort

        try {
          await fetch(
            `${SUPABASE_URL}/rest/v1/data_store?on_conflict=gym_id,key`,
            {
              method: 'POST',
              headers: { ...HEADERS, 'Prefer': 'resolution=merge-duplicates' },
              body: JSON.stringify({ gym_id: gymId, key, value: newVal, updated_at: new Date().toISOString() }),
            }
          );
        } catch {
          // Write failed — data is still in localStorage as cache
          // It will be retried on next user action
        }
      }, 300);

      return newVal;
    });
  }, [key]);

  // Cleanup pending writes on unmount
  useEffect(() => {
    return () => {
      dead.current = true;
      if (pendingWrite.current) {
        clearTimeout(pendingWrite.current);
        pendingWrite.current = null;
      }
    };
  }, []);

  return [value, setValueAndSync, cloudLoaded];
}
