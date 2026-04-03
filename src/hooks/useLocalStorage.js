import { useState, useEffect, useRef } from "react";

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

// Keys that always use their defaults (config, not data)
const ALWAYS_DEFAULT_KEYS = new Set(["hf_theme", "hf_session", "hf_users", "hf_gym_id", "hf_branding", "hf_settings", "hf_onboarding_complete", "hf_plans", "hf_ex", "hf_matrix", "hf_stripe_pk", "hf_integrations"]);

function isDemoLoaded() {
  try { return localStorage.getItem("hf_demo_loaded") === "true"; } catch { return false; }
}

function emptyDefault(val) {
  if (Array.isArray(val)) return [];
  if (val && typeof val === "object") return {};
  return val;
}

export function useLocalStorage(key, defaultValue) {
  const [value, setValue] = useState(() => {
    try {
      const stored = localStorage.getItem(key);
      if (stored !== null) return JSON.parse(stored);
    } catch {}
    // Config keys always use their defaults
    if (ALWAYS_DEFAULT_KEYS.has(key)) {
      return typeof defaultValue === 'function' ? defaultValue() : defaultValue;
    }
    // Data keys: only load demo defaults if demo data has been explicitly loaded
    if (!isDemoLoaded()) {
      const resolvedDefault = typeof defaultValue === 'function' ? defaultValue() : defaultValue;
      return emptyDefault(resolvedDefault);
    }
    return typeof defaultValue === 'function' ? defaultValue() : defaultValue;
  });

  const initialized = useRef(false);
  const saveTimeout = useRef(null);

  // Fetch from Supabase on mount
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const gymId = getGymId();

    (async () => {
      try {
        const res = await fetch(
          `${SUPABASE_URL}/rest/v1/data_store?select=value&gym_id=eq.${gymId}&key=eq.${key}`,
          { headers: HEADERS }
        );
        if (res.ok) {
          const rows = await res.json();
          if (rows.length > 0 && rows[0].value !== null) {
            setValue(rows[0].value);
            try { localStorage.setItem(key, JSON.stringify(rows[0].value)); } catch {}
          }
        }
      } catch { /* server unavailable, use local cache */ }
    })();
  }, [key]);

  // Save to localStorage + Supabase (debounced)
  // Don't sync gym data to __super__ — only super admin keys belong there
  const SUPER_KEYS = new Set(["hf_gyms_registry", "hf_master_exercises", "hf_users", "hf_feedback", "hf_session"]);
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
    const gymId = getGymId();

    // Skip Supabase sync if super admin context and this isn't a super admin key
    if (gymId === "__super__" && !SUPER_KEYS.has(key)) return;

    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(async () => {
      try {
        await fetch(
          `${SUPABASE_URL}/rest/v1/data_store?on_conflict=gym_id,key`,
          {
            method: 'POST',
            headers: { ...HEADERS, 'Prefer': 'resolution=merge-duplicates' },
            body: JSON.stringify({ gym_id: gymId, key, value, updated_at: new Date().toISOString() }),
          }
        );
      } catch { /* server unavailable */ }
    }, 500);
  }, [key, value]);

  return [value, setValue];
}
