import { useCallback, useEffect, useState } from 'react';

export interface BurnEntry {
  hash: string;
  ts: number;
  amount: string; // wei/sat string
  note: string | null;
  from: string | null;
}

interface BurnCache {
  chainId: number;
  entries: BurnEntry[];
  updatedAt: number;
}

const API_BASE = import.meta.env.VITE_BLOCKS_API_URL || 'https://blocks.nav.io';
const CHAIN_ID = 56;
const CACHE_VERSION = 'v2';
const CACHE_KEY = `navio-bridge.burns.${CACHE_VERSION}.${CHAIN_ID}`;
const PAGE_SIZE = 200;

function readCache(): BurnCache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as BurnCache;
  } catch {
    return null;
  }
}

function writeCache(c: BurnCache): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(c));
  } catch {
    /* quota */
  }
}

interface ApiResponse {
  data: Array<{
    timestamp: number;
    amount: string;
    tx_hash: string;
    note: string | null;
    from_address: string | null;
  }>;
  total: number;
  limit: number;
  offset: number;
}

export function useBurnHistory(): {
  entries: BurnEntry[];
  totalBurned: bigint;
  loading: boolean;
  progress: { fetched: number; total: number } | null;
  error: string | null;
  refresh: () => void;
} {
  const [entries, setEntries] = useState<BurnEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<{ fetched: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    const cached = readCache();
    if (cached) setEntries(cached.entries);
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        // Fetch first page to know total
        const first = await fetch(`${API_BASE}/api/bridge/burns?limit=${PAGE_SIZE}&offset=0`).then((r) => {
          if (!r.ok) throw new Error(`API ${r.status}`);
          return r.json() as Promise<ApiResponse>;
        });
        if (cancelled) return;

        const collected: BurnEntry[] = first.data.map(mapEntry);
        setProgress({ fetched: collected.length, total: first.total });

        // Page through remainder
        let offset = collected.length;
        while (offset < first.total && !cancelled) {
          const page = await fetch(`${API_BASE}/api/bridge/burns?limit=${PAGE_SIZE}&offset=${offset}`).then((r) => {
            if (!r.ok) throw new Error(`API ${r.status}`);
            return r.json() as Promise<ApiResponse>;
          });
          if (cancelled) return;
          collected.push(...page.data.map(mapEntry));
          offset = collected.length;
          setProgress({ fetched: offset, total: first.total });
          setEntries([...collected]);
        }

        if (cancelled) return;
        setEntries(collected);
        writeCache({ chainId: CHAIN_ID, entries: collected, updatedAt: Date.now() });
        setProgress(null);
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [nonce]);

  const totalBurned = entries.reduce((a, e) => a + BigInt(e.amount), 0n);
  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  return { entries, totalBurned, loading, progress, error, refresh };
}

function mapEntry(r: ApiResponse['data'][number]): BurnEntry {
  return {
    hash: r.tx_hash,
    ts: r.timestamp,
    amount: r.amount,
    note: r.note,
    from: r.from_address,
  };
}
