import { useEffect, useMemo, useState } from 'react';
import type { OutgoingEntry } from '../hooks/useNavioPayoutsApi';
import { useBlockTimestamps } from '../hooks/useBlockTimestamps';

const SERIES = '#7C7EFF'; // neon-purple — matches the "Distributed on Navio" KPI
const SURFACE = '#080D1F';
const HEIGHT = 220;
const MARGIN = { top: 14, right: 18, bottom: 26, left: 52 };

interface Point {
  x: number; // unix seconds (time mode) or block height (block mode)
  cum: number; // cumulative NAVIO paid out
  amount: number; // this payout, NAVIO
  block: number;
  hash: string;
}

function fmtCompact(v: number): string {
  return v.toLocaleString(undefined, { maximumFractionDigits: v < 10 ? 2 : 0 });
}

function fmtTick(v: number): string {
  if (v >= 10_000) {
    return new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 })
      .format(v)
      .toUpperCase();
  }
  return v.toLocaleString();
}

function fmtTickDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function fmtTooltipDate(ts: number): string {
  return new Date(ts * 1000).toLocaleString(undefined, {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Clean tick values from 0 to just above max. */
function niceTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0];
  const rough = max / count;
  const mag = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= rough) ?? 10 * mag;
  const ticks: number[] = [];
  for (let v = 0; v <= max + step * 0.001; v += step) ticks.push(v);
  return ticks;
}

export function PayoutChart({ outgoing }: { outgoing: OutgoingEntry[] }) {
  // Callback-ref state (not useRef): the container only mounts once data
  // arrives, so a mount-time effect would observe nothing and width would
  // stay 0 forever.
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    if (!container) return;
    const ro = new ResizeObserver((entries) => setWidth(entries[0].contentRect.width));
    ro.observe(container);
    return () => ro.disconnect();
  }, [container]);

  const sorted = useMemo(
    () => [...outgoing].sort((a, b) => a.block - b.block),
    [outgoing],
  );
  const heights = useMemo(() => [...new Set(sorted.map((o) => o.block))], [sorted]);
  const { timestamps, complete } = useBlockTimestamps(heights);

  // Prefer real block timestamps; fall back to block height while they resolve
  // (or if the indexer can't serve them) so the chart always renders.
  const timeMode = complete;
  const points: Point[] = useMemo(() => {
    const out: Point[] = [];
    let cum = 0;
    for (const o of sorted) {
      const amount = Number(BigInt(o.amount)) / 1e8;
      cum += amount;
      out.push({
        x: timeMode ? timestamps[o.block] : o.block,
        cum,
        amount,
        block: o.block,
        hash: o.hash,
      });
    }
    return out;
  }, [sorted, timeMode, timestamps]);

  if (points.length === 0) {
    return (
      <div className="glow-card !p-6 text-center text-sm text-white/50">No payouts yet.</div>
    );
  }

  const innerW = Math.max(0, width - MARGIN.left - MARGIN.right);
  const innerH = HEIGHT - MARGIN.top - MARGIN.bottom;

  const x0 = points[0].x;
  const x1 = points[points.length - 1].x;
  const xSpan = Math.max(1, x1 - x0);
  const yMax = points[points.length - 1].cum;
  const yTicks = niceTicks(yMax);
  const yTop = yTicks[yTicks.length - 1];

  const xPos = (x: number) => MARGIN.left + ((x - x0) / xSpan) * innerW;
  const yPos = (v: number) => MARGIN.top + innerH - (v / yTop) * innerH;

  // Cumulative payouts are a step function: hold each level until the next payout.
  const steps: string[] = [`M ${xPos(points[0].x)} ${yPos(0)}`];
  for (let i = 0; i < points.length; i++) {
    const px = xPos(points[i].x);
    steps.push(`L ${px} ${yPos(i === 0 ? 0 : points[i - 1].cum)}`);
    steps.push(`L ${px} ${yPos(points[i].cum)}`);
  }
  steps.push(`L ${MARGIN.left + innerW} ${yPos(yMax)}`);
  const linePath = steps.join(' ');
  const areaPath = `${linePath} L ${MARGIN.left + innerW} ${yPos(0)} L ${xPos(points[0].x)} ${yPos(0)} Z`;

  // ~4 x-axis ticks across the domain.
  const xTickCount = Math.min(4, points.length);
  const xTicks = Array.from({ length: xTickCount }, (_, i) =>
    x0 + (xSpan * i) / Math.max(1, xTickCount - 1),
  );

  const nearestIndex = (clientX: number): number => {
    const rect = container?.getBoundingClientRect();
    if (!rect) return 0;
    const px = clientX - rect.left;
    let best = 0;
    let bestD = Infinity;
    points.forEach((p, i) => {
      const d = Math.abs(xPos(p.x) - px);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    return best;
  };

  const h = hover !== null ? points[hover] : null;
  const tooltipLeft = h ? xPos(h.x) : 0;
  const flip = h ? tooltipLeft > width - 170 : false;
  const last = points[points.length - 1];

  return (
    <div
      ref={setContainer}
      className="glow-card !p-0 relative select-none"
      onPointerMove={(e) => setHover(nearestIndex(e.clientX))}
      onPointerLeave={() => setHover(null)}
      tabIndex={0}
      role="img"
      aria-label={`Cumulative NAVIO distributed over ${timeMode ? 'time' : 'block height'}: ${fmtCompact(yMax)} NAVIO across ${points.length} payouts`}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') setHover((i) => Math.min(points.length - 1, (i ?? -1) + 1));
        if (e.key === 'ArrowLeft') setHover((i) => Math.max(0, (i ?? points.length) - 1));
        if (e.key === 'Escape') setHover(null);
      }}
    >
      <div className="px-5 pt-4 flex items-baseline justify-between">
        <span className="mono text-[10px] tracking-[0.2em] uppercase text-white/55">
          Cumulative distributed
        </span>
        <span className="mono text-[10px] text-white/35">
          {timeMode ? '' : 'by block height · '}
          {fmtCompact(yMax)} NAVIO total
        </span>
      </div>

      {width > 0 && (
        <svg width={width} height={HEIGHT} className="block">
          {/* gridlines */}
          {yTicks.map((t) => (
            <g key={t}>
              <line
                x1={MARGIN.left}
                x2={MARGIN.left + innerW}
                y1={yPos(t)}
                y2={yPos(t)}
                stroke="rgba(255,255,255,0.06)"
                strokeWidth={1}
              />
              <text
                x={MARGIN.left - 8}
                y={yPos(t) + 3}
                textAnchor="end"
                className="mono"
                fontSize={9}
                fill="rgba(255,255,255,0.35)"
              >
                {fmtTick(t)}
              </text>
            </g>
          ))}

          {/* x ticks */}
          {xTicks.map((t, i) => (
            <text
              key={i}
              x={xPos(t)}
              y={HEIGHT - 8}
              textAnchor={i === 0 ? 'start' : i === xTicks.length - 1 ? 'end' : 'middle'}
              className="mono"
              fontSize={9}
              fill="rgba(255,255,255,0.35)"
            >
              {timeMode ? fmtTickDate(t) : `#${Math.round(t).toLocaleString()}`}
            </text>
          ))}

          <path d={areaPath} fill={SERIES} opacity={0.1} />
          <path
            d={linePath}
            fill="none"
            stroke={SERIES}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* end marker: surface ring keeps it legible over the line */}
          <circle cx={xPos(last.x)} cy={yPos(last.cum)} r={6} fill={SURFACE} />
          <circle cx={xPos(last.x)} cy={yPos(last.cum)} r={4} fill={SERIES} />

          {/* crosshair + hovered point */}
          {h && (
            <g>
              <line
                x1={xPos(h.x)}
                x2={xPos(h.x)}
                y1={MARGIN.top}
                y2={MARGIN.top + innerH}
                stroke="rgba(255,255,255,0.2)"
                strokeWidth={1}
              />
              <circle cx={xPos(h.x)} cy={yPos(h.cum)} r={6} fill={SURFACE} />
              <circle cx={xPos(h.x)} cy={yPos(h.cum)} r={4} fill={SERIES} />
            </g>
          )}
        </svg>
      )}

      {h && (
        <div
          className="absolute pointer-events-none rounded-lg border border-white/10 bg-navy-light/95 px-3 py-2 shadow-lg"
          style={{
            left: flip ? undefined : tooltipLeft + 10,
            right: flip ? width - tooltipLeft + 10 : undefined,
            top: MARGIN.top + 4,
          }}
        >
          <div className="mono text-[10px] text-white/45">
            {timeMode ? fmtTooltipDate(h.x) : `block #${h.block.toLocaleString()}`}
          </div>
          <div className="mt-1 flex items-center gap-1.5">
            <span className="inline-block w-3 h-0.5 rounded" style={{ background: SERIES }} />
            <span className="mono text-xs text-white/90 font-semibold">
              {fmtCompact(h.cum)} NAVIO
            </span>
          </div>
          <div className="mono text-[10px] text-white/45">
            +{fmtCompact(h.amount)} this payout
          </div>
        </div>
      )}
    </div>
  );
}
