"use client";

import { useEffect, useState } from "react";

/** Fetch JSON for a URL; null skips. Stale responses for an old URL are ignored. */
export function useJson<T>(url: string | null) {
  const [state, setState] = useState<{ url: string | null; data?: T; error?: string }>({ url: null });
  useEffect(() => {
    if (!url) return;
    let alive = true;
    fetch(url)
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error ?? r.statusText);
        if (alive) setState({ url, data: body });
      })
      .catch((e: Error) => alive && setState({ url, error: e.message }));
    return () => {
      alive = false;
    };
  }, [url]);
  const loading = url !== null && state.url !== url;
  return { data: loading ? undefined : state.data, error: loading ? undefined : state.error, loading };
}
