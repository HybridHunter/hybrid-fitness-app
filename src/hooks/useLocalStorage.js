import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";

const GYM_ID = 'default';

export function useLocalStorage(key, defaultValue) {
  // Always init from localStorage cache first (instant render)
  const [value, setValue] = useState(() => {
    try {
      const stored = localStorage.getItem(key);
      if (stored !== null) return JSON.parse(stored);
    } catch {}
    return typeof defaultValue === 'function' ? defaultValue() : defaultValue;
  });

  const initialized = useRef(false);
  const saveTimeout = useRef(null);

  // Fetch from Supabase on mount (if configured)
  useEffect(() => {
    if (!supabase || initialized.current) return;
    initialized.current = true;

    (async () => {
      try {
        const { data, error } = await supabase
          .from('data_store')
          .select('value')
          .eq('gym_id', GYM_ID)
          .eq('key', key)
          .single();

        if (!error && data && data.value !== null) {
          setValue(data.value);
          try { localStorage.setItem(key, JSON.stringify(data.value)); } catch {}
        }
      } catch { /* supabase unavailable, use local cache */ }
    })();
  }, [key]);

  // Save to localStorage always + to Supabase if configured (debounced)
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}

    if (supabase) {
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
      saveTimeout.current = setTimeout(async () => {
        try {
          await supabase
            .from('data_store')
            .upsert(
              { gym_id: GYM_ID, key, value, updated_at: new Date().toISOString() },
              { onConflict: 'gym_id,key' }
            );
        } catch { /* supabase unavailable */ }
      }, 500);
    }
  }, [key, value]);

  return [value, setValue];
}
