import { useState, useEffect, useRef } from "react";

const SUPABASE_URL = 'https://qzvxnklyeadbroesccxt.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6dnhua2x5ZWFkYnJvZXNjY3h0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNTI5MTgsImV4cCI6MjA5MDcyODkxOH0.nDa1iuZwS0E2j-rGizIvVuPRslYn7ugChPJiW-ejSMM';
const GYM_ID = 'default';
const HEADERS = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=minimal',
};

export function useLocalStorage(key, defaultValue) {
  const [value, setValue] = useState(() => {
    try {
      const stored = localStorage.getItem(key);
      if (stored !== null) return JSON.parse(stored);
    } catch {}
    return typeof defaultValue === 'function' ? defaultValue() : defaultValue;
  });

  const initialized = useRef(false);
  const saveTimeout = useRef(null);

  // Fetch from Supabase on mount
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    (async () => {
      try {
        const res = await fetch(
          `${SUPABASE_URL}/rest/v1/data_store?select=value&gym_id=eq.${GYM_ID}&key=eq.${key}`,
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
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}

    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(async () => {
      try {
        await fetch(
          `${SUPABASE_URL}/rest/v1/data_store?on_conflict=gym_id,key`,
          {
            method: 'POST',
            headers: { ...HEADERS, 'Prefer': 'resolution=merge-duplicates' },
            body: JSON.stringify({ gym_id: GYM_ID, key, value, updated_at: new Date().toISOString() }),
          }
        );
      } catch { /* server unavailable */ }
    }, 500);
  }, [key, value]);

  return [value, setValue];
}
