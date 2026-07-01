import { useCallback, useEffect, useRef, useState } from 'react';
import { AUDIT_CONFIG } from '../lib/contracts';
import { ensureBlsctLoaded } from '../lib/blsctLoader';

export interface OutgoingEntry {
  hash: string;
  block: number;
  amount: string;
}

interface NavioCache {
  key: string;
  creationHeight: number;
  outgoing: OutgoingEntry[];
  balance: string;
  syncedHeight: number;
  updatedAt: number;
}

const CACHE_KEY = 'navio-bridge.audit.v2';

function readCache(auditKey: string): NavioCache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw) as NavioCache;
    if (c.key !== auditKey) return null;
    return c;
  } catch {
    return null;
  }
}

function writeCache(c: NavioCache): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(c));
  } catch {
    /* quota */
  }
}

type Status = 'idle' | 'loading' | 'syncing' | 'ready' | 'error' | 'disabled';

export interface SyncProgress {
  height: number;
  tip: number;
  blocks: number;
  txKeys: number;
}

export function useNavioAudit(enabled: boolean = true): {
  status: Status;
  outgoing: OutgoingEntry[];
  totalPaidOut: bigint;
  balance: bigint;
  syncedHeight: number;
  chainTip: number | null;
  progress: SyncProgress | null;
  error: string | null;
  refresh: () => void;
} {
  const [status, setStatus] = useState<Status>('idle');
  const [outgoing, setOutgoing] = useState<OutgoingEntry[]>([]);
  const [balance, setBalance] = useState<bigint>(0n);
  const [syncedHeight, setSyncedHeight] = useState(0);
  const [chainTip, setChainTip] = useState<number | null>(null);
  const [progress, setProgress] = useState<SyncProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const clientRef = useRef<unknown | null>(null);

  useEffect(() => {
    if (!enabled) {
      setStatus('idle');
      return;
    }
    if (!AUDIT_CONFIG.auditKey) {
      setStatus('disabled');
      return;
    }
    let cancelled = false;

    const cached = readCache(AUDIT_CONFIG.auditKey);
    if (cached) {
      setOutgoing(cached.outgoing);
      setBalance(BigInt(cached.balance));
      setSyncedHeight(cached.syncedHeight);
    }

    (async () => {
      setStatus(cached ? 'syncing' : 'loading');
      setError(null);
      try {
        await ensureBlsctLoaded();
        if (cancelled) return;
        const sdk = await import('navio-sdk');
        if (cancelled) return;

        const client = new sdk.NavioClient({
          walletDbPath: AUDIT_CONFIG.walletDbName,
          databaseAdapter: 'indexeddb',
          backend: 'electrum',
          electrum: AUDIT_CONFIG.electrum,
          network: AUDIT_CONFIG.network,
          createWalletIfNotExists: true,
          restoreFromAuditKey: AUDIT_CONFIG.auditKey,
          restoreFromHeight: AUDIT_CONFIG.restoreFromHeight,
        });
        clientRef.current = client;

        await client.initialize();
        if (cancelled) return;
        setStatus('syncing');

        await client.sync({
          onProgress: (currentHeight, tipHeight, blocks, txKeys) => {
            if (cancelled) return;
            setProgress({ height: currentHeight, tip: tipHeight, blocks, txKeys });
            setChainTip(tipHeight);
            setSyncedHeight(currentHeight);
          },
        });
        if (cancelled) return;
        setProgress(null);
        // client.sync() returns blocks-processed-this-run, not the chain tip;
        // read the real tip so the synced height is correct after an
        // incremental sync (not just a fresh one).
        const tip = (await client.getChainTip()).height;
        setChainTip(tip);

        const outputs = await client.getAllOutputs();
        const bal = await client.getBalance();
        if (cancelled) return;

        const spentBySpendTx = new Map<string, { inputs: bigint; changeOut: bigint; block: number }>();
        const receivedByTx = new Map<string, bigint>();

        for (const o of outputs) {
          if (!o.tokenId) {
            const prev = receivedByTx.get(o.txHash) ?? 0n;
            receivedByTx.set(o.txHash, prev + BigInt(o.amount));
            if (o.isSpent && o.spentTxHash) {
              const e = spentBySpendTx.get(o.spentTxHash) ?? {
                inputs: 0n,
                changeOut: 0n,
                block: o.spentBlockHeight ?? 0,
              };
              e.inputs += BigInt(o.amount);
              if (o.spentBlockHeight) e.block = o.spentBlockHeight;
              spentBySpendTx.set(o.spentTxHash, e);
            }
          }
        }

        for (const [spendTx, entry] of spentBySpendTx) {
          entry.changeOut = receivedByTx.get(spendTx) ?? 0n;
        }

        const outgoingEntries: OutgoingEntry[] = [...spentBySpendTx.entries()]
          .map(([hash, e]) => ({ hash, block: e.block, amount: (e.inputs - e.changeOut).toString() }))
          .filter((e) => BigInt(e.amount) > 0n)
          .sort((a, b) => b.block - a.block);

        setOutgoing(outgoingEntries);
        setBalance(BigInt(bal));
        setSyncedHeight(tip);
        writeCache({
          key: AUDIT_CONFIG.auditKey,
          creationHeight: AUDIT_CONFIG.restoreFromHeight,
          outgoing: outgoingEntries,
          balance: bal.toString(),
          syncedHeight: tip,
          updatedAt: Date.now(),
        });
        setStatus('ready');
      } catch (err) {
        if (!cancelled) {
          const msg = (err as Error).message || String(err);
          const friendly = /websocket|connection/i.test(msg)
            ? `Electrum unreachable at ${AUDIT_CONFIG.electrum.host}:${AUDIT_CONFIG.electrum.port}. Server may be down or its TLS certificate has expired. ${msg}`
            : msg;
          setError(friendly);
          setStatus('error');
        }
      }
    })();

    return () => {
      cancelled = true;
      const c = clientRef.current as { disconnect?: () => Promise<void> } | null;
      c?.disconnect?.().catch(() => {});
      clientRef.current = null;
    };
  }, [nonce, enabled]);

  const totalPaidOut = outgoing.reduce((a, e) => a + BigInt(e.amount), 0n);
  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  return { status, outgoing, totalPaidOut, balance, syncedHeight, chainTip, progress, error, refresh };
}
