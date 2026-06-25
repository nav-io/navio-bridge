import { useEffect, useState } from 'react';
import { useNavcoinHeight } from '../hooks/useNavcoinHeight';
import { SWAP_START, SWAP_END, BLOCK_SECONDS, phaseFor, projectHeight, type SwapPhase } from '../lib/swap';

interface View {
  phase: SwapPhase;
  label: string;
  value: string;
  detail: string;
  progress: number; // 0..1 for active phase
}

function fmtDuration(seconds: number): string {
  if (seconds <= 0) return '0m';
  const d = Math.floor(seconds / 86_400);
  const h = Math.floor((seconds % 86_400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function SwapCountdown() {
  const { height, error, fetchedAt } = useNavcoinHeight();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(t);
  }, []);

  if (error && height === null) {
    return (
      <div className="glow-card !p-4 text-xs text-white/50 mono">
        <div className="tracking-[0.22em] uppercase text-white/35 mb-1">swap window</div>
        <div>Navcoin height unavailable — {error.slice(0, 80)}</div>
      </div>
    );
  }

  if (height === null) {
    return (
      <div className="glow-card !p-4 text-xs text-white/50 mono">
        <div className="tracking-[0.22em] uppercase text-white/35">loading Navcoin height…</div>
      </div>
    );
  }

  const view = buildView(height, now, fetchedAt);

  return (
    <div className="glow-card !p-4 sm:!p-5">
      <div className="flex items-baseline justify-between gap-3">
        <div className="mono text-[10px] tracking-[0.22em] uppercase text-white/45">{view.label}</div>
        <div className="mono text-[10px] tracking-[0.12em] text-white/30">
          #{height.toLocaleString()}
        </div>
      </div>

      <div className="mt-2 text-xl sm:text-2xl font-semibold gradient-text">{view.value}</div>

      <div className="mt-2 text-[11px] text-white/50">{view.detail}</div>

      {view.phase === 'active' && (
        <div className="mt-3 h-1.5 rounded-full bg-white/5 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-neon-blue via-neon-purple to-neon-pink transition-all duration-500"
            style={{ width: `${(view.progress * 100).toFixed(2)}%` }}
          />
        </div>
      )}

      <div className="mt-2 grid grid-cols-2 gap-2 mono text-[10px] text-white/35">
        <span>start #{SWAP_START.toLocaleString()}</span>
        <span className="text-right">end #{SWAP_END.toLocaleString()}</span>
      </div>
    </div>
  );
}

function buildView(height: number, now: number, fetchedAt: number | null): View {
  const projected = projectHeight(height, fetchedAt, now);

  if (phaseFor(projected) === 'pre') {
    const secs = (SWAP_START - projected) * BLOCK_SECONDS;
    return {
      phase: 'pre',
      label: 'swap starts in',
      value: fmtDuration(secs),
      detail: `${(SWAP_START - projected).toLocaleString()} blocks until swap opens (~30s / block)`,
      progress: 0,
    };
  }

  if (projected < SWAP_END) {
    const secs = (SWAP_END - projected) * BLOCK_SECONDS;
    const total = SWAP_END - SWAP_START;
    const done = projected - SWAP_START;
    return {
      phase: 'active',
      label: 'swap closes in',
      value: fmtDuration(secs),
      detail: `${(SWAP_END - projected).toLocaleString()} blocks left · ${((done / total) * 100).toFixed(1)}% elapsed`,
      progress: Math.min(1, Math.max(0, done / total)),
    };
  }

  return {
    phase: 'ended',
    label: 'swap window closed',
    value: 'Ended',
    detail: `Final block #${SWAP_END.toLocaleString()} reached (${(projected - SWAP_END).toLocaleString()} blocks ago).`,
    progress: 1,
  };
}
