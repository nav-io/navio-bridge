import { useCallback, useEffect, useState } from 'react';

export interface OutgoingEntry {
  hash: string;
  block: number;
  amount: string;
}

export interface StakeEventEntry {
  hash: string;
  block: number;
  amount: string;
  type: 'stake' | 'unstake';
}

interface Cache {
  api: string;
  outgoing: OutgoingEntry[];
  stakeEvents: StakeEventEntry[];
  netStaked: string;
  balance: string;
  syncedHeight: number;
  chainTip: number;
  updatedAt: number;
}

const API_BASE = import.meta.env.VITE_BLOCKS_API_URL || 'https://blocks.nav.io';
const CACHE_KEY = 'navio-bridge.payouts-api.v1';
const PAGE_SIZE = 500;

function readCache(): Cache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw) as Cache;
    if (c.api !== API_BASE) return null;
    return c;
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

interface SummaryResp {
  indexed: boolean;
  summary: {
    balance_sat: string;
    synced_height: number;
    chain_tip: number;
    error_message: string | null;
    updated_at: number;
  } | null;
  total_outgoing_sat: string;
  net_staked_sat?: string;
}

interface OutgoingResp {
  data: Array<{ spend_tx_hash: string; block_height: number; amount_sat: string }>;
  total: number;
  limit: number;
  offset: number;
}

interface StakeEventsResp {
  data: Array<{ tx_hash: string; event_type: 'stake' | 'unstake'; block_height: number; amount_sat: string }>;
  total: number;
  limit: number;
  offset: number;
}

type Status = 'idle' | 'loading' | 'ready' | 'error' | 'not-indexed';

export function useNavioPayoutsApi(enabled: boolean): {
  status: Status;
  outgoing: OutgoingEntry[];
  stakeEvents: StakeEventEntry[];
  netStaked: bigint;
  totalPaidOut: bigint;
  balance: bigint;
  syncedHeight: number;
  chainTip: number | null;
  error: string | null;
  refresh: () => void;
} {
  const [status, setStatus] = useState<Status>('idle');
  const [outgoing, setOutgoing] = useState<OutgoingEntry[]>([]);
  const [stakeEvents, setStakeEvents] = useState<StakeEventEntry[]>([]);
  const [netStaked, setNetStaked] = useState<bigint>(0n);
  const [balance, setBalance] = useState<bigint>(0n);
  const [syncedHeight, setSyncedHeight] = useState(0);
  const [chainTip, setChainTip] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    const cached = readCache();
    if (cached) {
      setOutgoing(cached.outgoing);
      setStakeEvents(cached.stakeEvents ?? []);
      setNetStaked(BigInt(cached.netStaked ?? '0'));
      setBalance(BigInt(cached.balance));
      setSyncedHeight(cached.syncedHeight);
      setChainTip(cached.chainTip);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const timer = setInterval(() => setNonce((n) => n + 1), 60_000);

    (async () => {
      setStatus('loading');
      setError(null);
      try {
        const summary = await fetch(`${API_BASE}/api/bridge/audit/summary`).then((r) => {
          if (!r.ok) throw new Error(`summary ${r.status}`);
          return r.json() as Promise<SummaryResp>;
        });
        if (cancelled) return;

        if (!summary.indexed || !summary.summary) {
          setStatus('not-indexed');
          return;
        }

        const first = await fetch(
          `${API_BASE}/api/bridge/audit/outgoing?limit=${PAGE_SIZE}&offset=0`,
        ).then((r) => {
          if (!r.ok) throw new Error(`outgoing ${r.status}`);
          return r.json() as Promise<OutgoingResp>;
        });
        if (cancelled) return;

        const collected: OutgoingEntry[] = first.data.map(mapEntry);
        let offset = collected.length;
        while (offset < first.total && !cancelled) {
          const page = await fetch(
            `${API_BASE}/api/bridge/audit/outgoing?limit=${PAGE_SIZE}&offset=${offset}`,
          ).then((r) => {
            if (!r.ok) throw new Error(`outgoing ${r.status}`);
            return r.json() as Promise<OutgoingResp>;
          });
          if (cancelled) return;
          collected.push(...page.data.map(mapEntry));
          offset = collected.length;
        }
        if (cancelled) return;

        // Stake / unstake events (small set; one page is plenty).
        let stakes: StakeEventEntry[] = [];
        try {
          const stakeResp = await fetch(
            `${API_BASE}/api/bridge/audit/stakes?limit=${PAGE_SIZE}&offset=0`,
          ).then((r) => (r.ok ? (r.json() as Promise<StakeEventsResp>) : null));
          if (cancelled) return;
          if (stakeResp) stakes = stakeResp.data.map(mapStake);
        } catch {
          /* stakes are optional; older indexers may not expose them */
        }
        const netStakedSat = BigInt(summary.net_staked_sat ?? '0');

        const bal = BigInt(summary.summary.balance_sat);
        setOutgoing(collected);
        setStakeEvents(stakes);
        setNetStaked(netStakedSat);
        setBalance(bal);
        setSyncedHeight(summary.summary.synced_height);
        setChainTip(summary.summary.chain_tip);
        writeCache({
          api: API_BASE,
          outgoing: collected,
          stakeEvents: stakes,
          netStaked: netStakedSat.toString(),
          balance: bal.toString(),
          syncedHeight: summary.summary.synced_height,
          chainTip: summary.summary.chain_tip,
          updatedAt: Date.now(),
        });
        setStatus('ready');
      } catch (err) {
        if (!cancelled) {
          setError((err as Error).message);
          setStatus('error');
        }
      }
    })();

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [enabled, nonce]);

  const totalPaidOut = outgoing.reduce((a, e) => a + BigInt(e.amount), 0n);
  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  return { status, outgoing, stakeEvents, netStaked, totalPaidOut, balance, syncedHeight, chainTip, error, refresh };
}

function mapEntry(r: OutgoingResp['data'][number]): OutgoingEntry {
  return { hash: r.spend_tx_hash, block: r.block_height, amount: r.amount_sat };
}

function mapStake(r: StakeEventsResp['data'][number]): StakeEventEntry {
  return { hash: r.tx_hash, block: r.block_height, amount: r.amount_sat, type: r.event_type };
}
