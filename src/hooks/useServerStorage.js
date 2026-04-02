import { useState, useEffect, useCallback, useRef } from "react";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:3002";

function getToken() {
  try { return localStorage.getItem("hf_jwt"); } catch { return null; }
}

export function useServerStorage(key, defaultValue) {
  // Initialize from localStorage cache first (for instant render)
  const [value, setValue] = useState(() => {
    try {
      const cached = localStorage.getItem(key);
      if (cached !== null) return JSON.parse(cached);
    } catch {}
    return typeof defaultValue === 'function' ? defaultValue() : defaultValue;
  });

  const initialized = useRef(false);
  const saveTimeout = useRef(null);

  // Fetch from server on mount
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const fetchData = async () => {
      try {
        const token = getToken();
        const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
        const res = await fetch(`${API_BASE}/api/data/${key}`, { headers });
        const data = await res.json();
        if (data.value !== null && data.value !== undefined) {
          setValue(data.value);
          localStorage.setItem(key, JSON.stringify(data.value)); // update local cache
        }
      } catch {
        // Server unavailable — use local cache, which is already set
      }
    };
    fetchData();
  }, [key]);

  // Debounced save to server + localStorage on changes
  const setValueAndSync = useCallback((updater) => {
    setValue(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;

      // Save to localStorage immediately (cache)
      try { localStorage.setItem(key, JSON.stringify(next)); } catch {}

      // Debounce save to server (300ms)
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
      saveTimeout.current = setTimeout(async () => {
        try {
          const token = getToken();
          const headers = { 'Content-Type': 'application/json' };
          if (token) headers['Authorization'] = `Bearer ${token}`;
          await fetch(`${API_BASE}/api/data/${key}`, {
            method: 'PUT',
            headers,
            body: JSON.stringify({ value: next }),
          });
        } catch {
          // Server unavailable — data is safe in localStorage
        }
      }, 300);

      return next;
    });
  }, [key]);

  return [value, setValueAndSync];
}
