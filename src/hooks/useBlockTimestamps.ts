import { useEffect, useState } from 'react';

const API_BASE = import.meta.env.VITE_BLOCKS_API_URL || 'https://blocks.nav.io';
const CACHE_KEY = 'navio-bridge.block-ts.v1';
const CONCURRENCY = 8;

type TsMap = Record<number, number>;

function readCache(): TsMap {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as TsMap) : {};
  } catch {
    return {};
  }
}

function writeCache(map: TsMap): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(map));
  } catch {
    /* quota */
  }
}

/**
 * Resolves block heights to unix timestamps via the blocks.nav.io indexer.
 * Block timestamps are immutable, so resolved heights are cached in
 * localStorage and never re-fetched.
 */
export function useBlockTimestamps(heights: number[]): {
  timestamps: TsMap;
  complete: boolean;
} {
  const [timestamps, setTimestamps] = useState<TsMap>(readCache);

  const key = heights.length ? heights.join(',') : '';

  useEffect(() => {
    if (!key) return;
    const wanted = key.split(',').map(Number);
    let cancelled = false;

    (async () => {
      const cached = readCache();
      const missing = [...new Set(wanted)].filter((h) => cached[h] === undefined);
      if (missing.length === 0) {
        setTimestamps(cached);
        return;
      }

      const resolved: TsMap = { ...cached };
      for (let i = 0; i < missing.length && !cancelled; i += CONCURRENCY) {
        const batch = missing.slice(i, i + CONCURRENCY);
        const results = await Promise.all(
          batch.map(async (h) => {
            try {
              const r = await fetch(`${API_BASE}/api/blocks/${h}`);
              if (!r.ok) return null;
              const b = (await r.json()) as { timestamp?: number };
              return typeof b.timestamp === 'number' ? ([h, b.timestamp] as const) : null;
            } catch {
              return null;
            }
          }),
        );
        for (const res of results) {
          if (res) resolved[res[0]] = res[1];
        }
        if (!cancelled) setTimestamps({ ...resolved });
      }
      if (!cancelled) writeCache(resolved);
    })();

    return () => {
      cancelled = true;
    };
  }, [key]);

  const complete = key !== '' && key.split(',').every((h) => timestamps[Number(h)] !== undefined);
  return { timestamps, complete };
}
