import { useEffect, useState } from 'react';
import { useNavcoinHeight } from './useNavcoinHeight';
import { phaseFor, projectHeight, type SwapPhase } from '../lib/swap';

/**
 * Derives the swap phase from the live Navcoin height. `started` is true once
 * the chain has reached SWAP_START (swap active or already ended); the withdraw
 * flow is gated on it. `ready` is false until a height is known (no cache yet).
 */
export function useSwapPhase(): {
  phase: SwapPhase | null;
  started: boolean;
  ready: boolean;
  height: number | null;
} {
  const { height, fetchedAt } = useNavcoinHeight();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const ready = height !== null;
  const projected = ready ? projectHeight(height, fetchedAt, now) : null;
  const phase = projected === null ? null : phaseFor(projected);
  const started = phase === 'active' || phase === 'ended';

  return { phase, started, ready, height };
}
