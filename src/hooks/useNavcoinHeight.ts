import { useEffect, useState } from 'react';

const ELECTRUM_WSS =
  (import.meta.env.VITE_NAVCOIN_ELECTRUM_WSS as string | undefined) ||
  'wss://electrum3.nav.community:40004';

const CACHE_KEY = 'navio-bridge.navcoin-height.v1';
const REFRESH_MS = 60_000;

interface Cache {
  height: number;
  at: number;
}

function readCache(): Cache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Cache;
  } catch {
    return null;
  }
}

function writeCache(c: Cache): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(c));
  } catch {
    /* quota */
  }
}

export function useNavcoinHeight(): {
  height: number | null;
  loading: boolean;
  error: string | null;
  fetchedAt: number | null;
} {
  const cached = readCache();
  const [height, setHeight] = useState<number | null>(cached?.height ?? null);
  const [fetchedAt, setFetchedAt] = useState<number | null>(cached?.at ?? null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchHeight = async (): Promise<void> => {
      if (cancelled) return;
      setLoading(true);
      try {
        const h = await queryElectrumHeight(ELECTRUM_WSS);
        if (cancelled) return;
        setHeight(h);
        setFetchedAt(Date.now());
        setError(null);
        writeCache({ height: h, at: Date.now() });
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchHeight();
    const timer = setInterval(fetchHeight, REFRESH_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  return { height, loading, error, fetchedAt };
}

function queryElectrumHeight(url: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try { ws.close(); } catch { /* ignore */ }
      reject(new Error('electrum timeout'));
    }, 8_000);

    const send = (id: number, method: string, params: unknown[] = []) =>
      ws.send(JSON.stringify({ id, method, params }));

    ws.onopen = () => {
      send(1, 'server.version', ['navio-bridge', '1.5']);
      send(2, 'blockchain.headers.subscribe');
    };

    ws.onmessage = (ev) => {
      if (settled) return;
      try {
        const msg = JSON.parse(typeof ev.data === 'string' ? ev.data : String(ev.data));
        if (msg.id === 2 && msg.result) {
          const h = Number(msg.result.height ?? msg.result.block_height);
          if (Number.isFinite(h)) {
            settled = true;
            clearTimeout(timer);
            try { ws.close(); } catch { /* ignore */ }
            resolve(h);
            return;
          }
        }
        if (msg.error) {
          settled = true;
          clearTimeout(timer);
          try { ws.close(); } catch { /* ignore */ }
          reject(new Error(msg.error.message || 'electrum error'));
        }
      } catch {
        /* ignore parse errors */
      }
    };

    ws.onerror = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new Error('electrum websocket error'));
    };

    ws.onclose = () => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        reject(new Error('electrum connection closed'));
      }
    };
  });
}
