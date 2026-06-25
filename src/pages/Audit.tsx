import { useState } from 'react';
import { useBurnHistory, type BurnEntry } from '../hooks/useBurnHistory';
import { useNavioAudit } from '../hooks/useNavioAudit';
import { useNavioPayoutsApi, type OutgoingEntry } from '../hooks/useNavioPayoutsApi';
import { Panel } from '../components/Panel';
import { AUDIT_CONFIG } from '../lib/contracts';
import { formatUnits } from 'viem';

type Source = 'indexer' | 'wallet';

const NAV_DEC = 8;

function fmtNav(v: bigint): string {
  return Number(formatUnits(v, NAV_DEC)).toLocaleString(undefined, {
    maximumFractionDigits: 4,
  });
}

function fmtDate(ts: number): string {
  if (!ts) return '—';
  return new Date(ts * 1000).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function short(hash: string, head = 8, tail = 6): string {
  if (hash.length <= head + tail + 3) return hash;
  return `${hash.slice(0, head)}…${hash.slice(-tail)}`;
}

function pct(h: number, tip: number): string {
  if (!tip) return '0';
  return ((h / tip) * 100).toFixed(1);
}

export function AuditPage() {
  const [source, setSource] = useState<Source>('indexer');

  const burn = useBurnHistory();
  const api = useNavioPayoutsApi(source === 'indexer');
  const wallet = useNavioAudit(source === 'wallet');

  const active = source === 'wallet' ? wallet : api;

  const totalBurned = burn.totalBurned;
  const totalPaid = active.totalPaidOut;
  const balance = active.balance;

  const match = totalBurned === totalPaid;
  const delta = totalBurned - totalPaid;

  return (
    <div className="space-y-8">
      <SourceSwitch value={source} onChange={setSource} />

      {source === 'wallet' && wallet.status === 'syncing' && wallet.progress && (
        <SyncBar progress={wallet.progress} />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Kpi
          label="Burned"
          value={fmtNav(totalBurned)}
          unit="wNAV"
          accent="blue"
          subtitle={`${burn.entries.length} burn${burn.entries.length === 1 ? '' : 's'}`}
        />
        <Kpi
          label="Distributed on Navio"
          value={fmtNav(totalPaid)}
          unit="NAVIO"
          accent="purple"
          subtitle={`${active.outgoing.length} payout${active.outgoing.length === 1 ? '' : 's'}`}
        />
        <Kpi
          label="Remaining balance"
          value={fmtNav(balance)}
          unit="NAVIO"
          accent="pink"
          subtitle={
            source === 'wallet' && wallet.status === 'disabled'
              ? 'audit key not set'
              : active.syncedHeight
                ? `synced to #${active.syncedHeight}`
                : undefined
          }
        />
      </div>

      <Reconciliation match={match} delta={delta} totalBurned={totalBurned} totalPaid={totalPaid} />

      <SyncStatus burn={burn} source={source} api={api} wallet={wallet} />

      <section>
        <SectionHeader
          title="Audit key"
          right={AUDIT_CONFIG.auditKey ? <CopyChip text={AUDIT_CONFIG.auditKey} /> : undefined}
        >
          <div className="mt-2 mono text-[11px] break-all text-white/55 text-center sm:text-left">
            {AUDIT_CONFIG.auditKey || 'not configured'}
          </div>
          <div className="mt-1 text-[10px] mono tracking-[0.16em] uppercase text-white/30 text-center sm:text-left">
            view-only · 32-byte view key ‖ 48-byte public spending key
          </div>
        </SectionHeader>
      </section>

      <section>
        <SectionHeader
          title="Activity"
          right={
            <button
              onClick={() => {
                burn.refresh();
                active.refresh();
              }}
              className="ghost-btn !px-3 !py-1.5 !text-xs"
            >
              Refresh
            </button>
          }
        />
        <ActivityTable burn={burn.entries} navio={active.outgoing} />
      </section>
    </div>
  );
}

function SyncBar({ progress }: { progress: { height: number; tip: number; blocks: number; txKeys: number } }) {
  const ratio = progress.tip ? Math.min(1, progress.height / progress.tip) : 0;
  return (
    <Panel className="!p-4">
      <div className="flex items-baseline justify-between mono text-[10px] tracking-[0.22em] uppercase text-white/55">
        <span>syncing navio wallet</span>
        <span className="text-neon-blue">{(ratio * 100).toFixed(1)}%</span>
      </div>
      <div className="mt-2 h-1.5 rounded-full bg-white/5 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-neon-blue via-neon-purple to-neon-pink transition-all duration-300"
          style={{ width: `${(ratio * 100).toFixed(2)}%` }}
        />
      </div>
      <div className="mt-2 flex flex-wrap gap-4 mono text-[10px] text-white/50">
        <span>
          block <span className="text-white/80">{progress.height.toLocaleString()}</span> /{' '}
          {progress.tip.toLocaleString()}
        </span>
        <span>
          blocks scanned <span className="text-white/80">{progress.blocks.toLocaleString()}</span>
        </span>
        <span>
          tx keys <span className="text-white/80">{progress.txKeys.toLocaleString()}</span>
        </span>
      </div>
    </Panel>
  );
}

function Kpi({
  label,
  value,
  unit,
  accent,
  subtitle,
}: {
  label: string;
  value: string;
  unit: string;
  accent: 'blue' | 'purple' | 'pink';
  subtitle?: string;
}) {
  const dot = {
    blue: 'bg-neon-blue shadow-[0_0_10px_rgba(79,179,255,0.7)]',
    purple: 'bg-neon-purple shadow-[0_0_10px_rgba(124,126,255,0.7)]',
    pink: 'bg-neon-pink shadow-[0_0_10px_rgba(242,93,156,0.7)]',
  }[accent];

  return (
    <Panel className="!p-5">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] mono text-white/45">
        <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
        {label}
      </div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="text-2xl font-semibold gradient-text">{value}</span>
        <span className="mono text-xs text-white/55">{unit}</span>
      </div>
      {subtitle && (
        <div className="mt-1 mono text-[10px] tracking-[0.14em] uppercase text-white/35">{subtitle}</div>
      )}
    </Panel>
  );
}

function Reconciliation({
  match,
  delta,
  totalBurned,
  totalPaid,
}: {
  match: boolean;
  delta: bigint;
  totalBurned: bigint;
  totalPaid: bigint;
}) {
  const color = match ? 'text-neon-green' : totalBurned > totalPaid ? 'text-neon-pink' : 'text-neon-blue';
  const label = match
    ? '1:1 match'
    : totalBurned > totalPaid
      ? `${fmtNav(delta)} awaiting payout`
      : `${fmtNav(-delta)} surplus on Navio`;

  return (
    <Panel className={`!p-5 ${match ? '!border-neon-green/40' : ''}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="mono text-[10px] tracking-[0.24em] uppercase text-white/45">reconciliation</div>
          <div className={`mt-1 text-lg font-semibold mono ${color}`}>{label}</div>
        </div>
        <div className={`mono text-[11px] tracking-wider px-3 py-1 rounded-full border ${
          match ? 'border-neon-green/40 text-neon-green' : 'border-white/15 text-white/60'
        }`}>
          {match ? '✓ balanced' : '⊘ drift'}
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 text-xs mono">
        <ReconRow label="Burned" value={`${fmtNav(totalBurned)} wNAV`} />
        <ReconRow label="Distributed" value={`${fmtNav(totalPaid)} NAVIO`} />
      </div>
    </Panel>
  );
}

function ReconRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between rounded-lg border border-white/5 bg-black/20 p-2.5">
      <span className="text-white/40">{label}</span>
      <span className="text-white/85">{value}</span>
    </div>
  );
}

function SyncStatus({
  burn,
  source,
  api,
  wallet,
}: {
  burn: ReturnType<typeof useBurnHistory>;
  source: Source;
  api: ReturnType<typeof useNavioPayoutsApi>;
  wallet: ReturnType<typeof useNavioAudit>;
}) {
  const burnText = burn.loading
    ? burn.progress
      ? `fetching burns ${burn.progress.fetched} / ${burn.progress.total}`
      : 'loading burns…'
    : burn.error
      ? `error: ${burn.error.slice(0, 80)}`
      : `up-to-date`;

  const navText =
    source === 'indexer'
      ? {
          idle: 'idle',
          loading: 'querying indexer…',
          ready: 'up-to-date',
          'not-indexed': 'indexer not configured',
          error: `error: ${(api.error ?? '').slice(0, 120)}`,
        }[api.status]
      : {
          idle: 'idle',
          loading: 'loading navio-sdk…',
          syncing: wallet.progress
            ? `syncing ${wallet.progress.height.toLocaleString()} / ${wallet.progress.tip.toLocaleString()} (${pct(wallet.progress.height, wallet.progress.tip)}%)`
            : 'syncing Navio wallet…',
          ready: 'up-to-date',
          error: `error: ${(wallet.error ?? '').slice(0, 120)}`,
          disabled: 'audit key not configured',
        }[wallet.status];

  const navOk = source === 'indexer' ? api.status === 'ready' : wallet.status === 'ready';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mono text-[11px]">
      <StatusPill label="BSC" ok={!burn.loading && !burn.error} text={burnText} />
      <StatusPill label={source === 'indexer' ? 'Navio · indexer' : 'Navio · wallet'} ok={navOk} text={navText} />
    </div>
  );
}

function SourceSwitch({ value, onChange }: { value: Source; onChange: (s: Source) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3">
      <div className="min-w-0">
        <div className="mono text-[10px] tracking-[0.24em] uppercase text-white/45">data source</div>
        <div className="mt-0.5 text-xs text-white/60">
          {value === 'indexer'
            ? 'Reading payouts from blocks.nav.io indexer. Fast, no local sync.'
            : 'Syncing the bridge wallet in your browser with the public audit key. Trustless.'}
        </div>
      </div>
      <div className="flex items-center gap-0.5 rounded-full border border-white/10 bg-white/[0.03] p-0.5 shrink-0 mono text-[10px]">
        <Pill active={value === 'indexer'} onClick={() => onChange('indexer')}>
          indexer
        </Pill>
        <Pill active={value === 'wallet'} onClick={() => onChange('wallet')}>
          self-verify
        </Pill>
      </div>
    </div>
  );
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full uppercase tracking-[0.16em] transition-all ${
        active ? 'bg-white/10 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]' : 'text-white/50 hover:text-white'
      }`}
    >
      {children}
    </button>
  );
}

function StatusPill({ label, ok, text }: { label: string; ok: boolean; text: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2">
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          ok ? 'bg-neon-green shadow-[0_0_8px_rgba(94,234,212,0.7)]' : 'bg-white/30 animate-flicker'
        }`}
      />
      <span className="text-white/50 uppercase tracking-[0.16em]">{label}</span>
      <span className="text-white/70 truncate">{text}</span>
    </div>
  );
}

function SectionHeader({
  title,
  right,
  children,
}: {
  title: string;
  right?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="mono text-[10px] tracking-[0.24em] uppercase text-white/45">{title}</div>
        {children}
      </div>
      {right}
    </div>
  );
}

function CopyChip({ text }: { text: string }) {
  return (
    <button
      onClick={() => navigator.clipboard?.writeText(text).catch(() => {})}
      className="ghost-btn !px-2.5 !py-1 !text-[10px] shrink-0"
    >
      copy
    </button>
  );
}

function ActivityTable({ burn, navio }: { burn: BurnEntry[]; navio: OutgoingEntry[] }) {
  const count = Math.max(burn.length, navio.length);
  if (count === 0) {
    return (
      <div className="glow-card !p-6 text-center text-sm text-white/50">
        No activity yet.
      </div>
    );
  }

  return (
    <div className="glow-card !p-0 overflow-hidden">
      <div className="grid grid-cols-2">
        <ColumnHeader title="BSC burns" count={burn.length} />
        <ColumnHeader title="Navio payouts" count={navio.length} />
      </div>
      <div className="grid grid-cols-2">
        <div>
          {burn.length === 0 ? (
            <EmptyRow />
          ) : (
            burn.slice(0, 50).map((b) => (
              <Row
                key={b.hash}
                primary={fmtDate(b.ts)}
                secondary={`${fmtNav(BigInt(b.amount))} wNAV`}
                tail={short(b.hash)}
                href={`https://bscscan.com/tx/${b.hash}`}
              />
            ))
          )}
        </div>
        <div className="border-l border-white/5">
          {navio.length === 0 ? (
            <EmptyRow />
          ) : (
            navio.slice(0, 50).map((n) => (
              <Row
                key={n.hash}
                primary={`block #${n.block}`}
                secondary={`${fmtNav(BigInt(n.amount))} NAVIO`}
                tail={short(n.hash)}
                href={`https://blocks.nav.io/tx/${n.hash}`}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function ColumnHeader({ title, count }: { title: string; count: number }) {
  return (
    <div className="px-5 py-3 bg-white/[0.03] border-b border-white/5 flex items-center justify-between">
      <span className="mono text-[10px] tracking-[0.2em] uppercase text-white/55">{title}</span>
      <span className="mono text-[10px] text-white/35">{count}</span>
    </div>
  );
}

function Row({
  primary,
  secondary,
  tail,
  href,
}: {
  primary: string;
  secondary: string;
  tail: string;
  href: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="block px-5 py-3 border-b border-white/5 hover:bg-white/[0.03] transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs text-white/75">{primary}</div>
          <div className="mono text-[11px] text-neon-blue">{secondary}</div>
        </div>
        <div className="mono text-[10px] text-white/35 shrink-0">{tail}</div>
      </div>
    </a>
  );
}

function EmptyRow() {
  return <div className="px-5 py-6 text-center text-xs text-white/30">—</div>;
}
