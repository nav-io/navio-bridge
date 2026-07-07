import { useCallback, useEffect, useState } from 'react';

export interface OutgoingEntry {
  hash: string;
  block: number;
  amount: string;
  /**
   * True when this payout reconciled 1:1 to one or more wNAV burns. Undefined
   * from the trustless wallet source (which does not run burn matching); only
   * `matched === false` marks a flagged, unreconciled outflow.
   */
  matched?: boolean;
}

/** A wNAV burn with no matching Navio payout yet — a pending payout. */
export interface AwaitingBurn {
  txHash: string | null;
  amount: string;
  timestamp: number;
  note: string | null;
}

/** Burn↔payout reconciliation snapshot from the indexer. */
export interface Reconciliation {
  /** Sum of burns settled 1:1 by a payout (sats) — provably distributed. */
  settledSat: bigint;
  /** Sum of burns not yet settled (sats) — burned but awaiting payout. */
  awaitingSat: bigint;
  /** Sum of payout outflows matching no burn (sats) — an inconsistency. */
  unmatchedPayoutSat: bigint;
  /** Number of payout outflows matching no burn. */
  unmatchedPayoutCount: number;
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
  earnedRewards: string;
  balance: string;
  syncedHeight: number;
  chainTip: number;
  updatedAt: number;
  awaitingBurns?: AwaitingBurn[];
  recon?: {
    settledSat: string;
    awaitingSat: string;
    unmatchedPayoutSat: string;
    unmatchedPayoutCount: number;
  };
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
    earned_rewards_sat?: string;
    synced_height: number;
    chain_tip: number;
    error_message: string | null;
    updated_at: number;
    settled_sat?: string;
    awaiting_sat?: string;
    unmatched_payout_sat?: string;
    unmatched_payout_count?: number;
  } | null;
  total_outgoing_sat: string;
  net_staked_sat?: string;
}

interface OutgoingResp {
  data: Array<{ spend_tx_hash: string; block_height: number; amount_sat: string; matched?: boolean }>;
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
  earnedRewards: bigint;
  totalPaidOut: bigint;
  balance: bigint;
  syncedHeight: number;
  chainTip: number | null;
  reconciliation: Reconciliation | null;
  error: string | null;
  refresh: () => void;
} {
  const [status, setStatus] = useState<Status>('idle');
  const [outgoing, setOutgoing] = useState<OutgoingEntry[]>([]);
  const [stakeEvents, setStakeEvents] = useState<StakeEventEntry[]>([]);
  const [netStaked, setNetStaked] = useState<bigint>(0n);
  const [earnedRewards, setEarnedRewards] = useState<bigint>(0n);
  const [balance, setBalance] = useState<bigint>(0n);
  const [syncedHeight, setSyncedHeight] = useState(0);
  const [chainTip, setChainTip] = useState<number | null>(null);
  const [reconciliation, setReconciliation] = useState<Reconciliation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    const cached = readCache();
    if (cached) {
      setOutgoing(cached.outgoing);
      setStakeEvents(cached.stakeEvents ?? []);
      setNetStaked(BigInt(cached.netStaked ?? '0'));
      setEarnedRewards(BigInt(cached.earnedRewards ?? '0'));
      setBalance(BigInt(cached.balance));
      setSyncedHeight(cached.syncedHeight);
      setChainTip(cached.chainTip);
      if (cached.recon) {
        setReconciliation({
          settledSat: BigInt(cached.recon.settledSat),
          awaitingSat: BigInt(cached.recon.awaitingSat),
          unmatchedPayoutSat: BigInt(cached.recon.unmatchedPayoutSat),
          unmatchedPayoutCount: cached.recon.unmatchedPayoutCount,
        });
      }
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
        const earnedRewardsSat = BigInt(summary.summary.earned_rewards_sat ?? '0');

        // Burn↔payout reconciliation (older indexers omit these fields).
        const s = summary.summary;
        const recon: Reconciliation | null =
          s.settled_sat !== undefined
            ? {
                settledSat: BigInt(s.settled_sat),
                awaitingSat: BigInt(s.awaiting_sat ?? '0'),
                unmatchedPayoutSat: BigInt(s.unmatched_payout_sat ?? '0'),
                unmatchedPayoutCount: s.unmatched_payout_count ?? 0,
              }
            : null;

        const bal = BigInt(summary.summary.balance_sat);
        setOutgoing(collected);
        setStakeEvents(stakes);
        setNetStaked(netStakedSat);
        setEarnedRewards(earnedRewardsSat);
        setBalance(bal);
        setSyncedHeight(summary.summary.synced_height);
        setChainTip(summary.summary.chain_tip);
        setReconciliation(recon);
        writeCache({
          api: API_BASE,
          outgoing: collected,
          stakeEvents: stakes,
          netStaked: netStakedSat.toString(),
          earnedRewards: earnedRewardsSat.toString(),
          balance: bal.toString(),
          syncedHeight: summary.summary.synced_height,
          chainTip: summary.summary.chain_tip,
          updatedAt: Date.now(),
          recon: recon
            ? {
                settledSat: recon.settledSat.toString(),
                awaitingSat: recon.awaitingSat.toString(),
                unmatchedPayoutSat: recon.unmatchedPayoutSat.toString(),
                unmatchedPayoutCount: recon.unmatchedPayoutCount,
              }
            : undefined,
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

  return { status, outgoing, stakeEvents, netStaked, earnedRewards, totalPaidOut, balance, syncedHeight, chainTip, reconciliation, error, refresh };
}

function mapEntry(r: OutgoingResp['data'][number]): OutgoingEntry {
  return { hash: r.spend_tx_hash, block: r.block_height, amount: r.amount_sat, matched: r.matched !== false };
}

function mapStake(r: StakeEventsResp['data'][number]): StakeEventEntry {
  return { hash: r.tx_hash, block: r.block_height, amount: r.amount_sat, type: r.event_type };
}
