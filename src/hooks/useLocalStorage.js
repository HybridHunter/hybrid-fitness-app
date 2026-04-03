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
const LOCAL_ONLY_KEYS = new Set(["hf_theme", "hf_gym_id"]);

// Keys that live in __super__ context
const SUPER_KEYS = new Set(["hf_gyms_registry", "hf_master_exercises", "hf_users", "hf_feedback", "hf_session"]);

function resolveDefault(defaultValue) {
  return typeof defaultValue === 'function' ? defaultValue() : defaultValue;
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
        if (res.ok) {
          const rows = await res.json();
          if (rows.length > 0 && rows[0].value !== null) {
            // Cloud has data — this is the truth
            const cloudVal = rows[0].value;
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

  // Step 3: Write function — writes to Supabase first, then updates local state
  const setValueAndSync = useCallback((newValOrFn) => {
    if (dead.current) return;

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
