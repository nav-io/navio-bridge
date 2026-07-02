/** Navcoin block heights bounding the bridge swap window. */
export const SWAP_START = 10_500_000;
export const SWAP_END = 11_000_000;
export const BLOCK_SECONDS = 30;

export type SwapPhase = 'pre' | 'active' | 'ended';

/** Project the current height forward from the last fetch using ~30s blocks. */
export function projectHeight(height: number, fetchedAt: number | null, now: number): number {
  const drift = fetchedAt ? Math.floor((now - fetchedAt) / 1000 / BLOCK_SECONDS) : 0;
  return height + drift;
}

export function phaseFor(projected: number): SwapPhase {
  if (projected < SWAP_START) return 'pre';
  if (projected < SWAP_END) return 'active';
  return 'ended';
}

/**
 * Temporary manual withdrawal window (UTC epoch ms), independent of chain
 * height. Opens withdrawals 2026-07-02 16:00–17:00 UTC. Remove after it closes.
 */
export const TEMP_WITHDRAW_OPEN = Date.UTC(2026, 6, 2, 16, 0, 0);
export const TEMP_WITHDRAW_CLOSE = Date.UTC(2026, 6, 2, 18, 0, 0);

export function inTempWithdrawWindow(now: number): boolean {
  return now >= TEMP_WITHDRAW_OPEN && now < TEMP_WITHDRAW_CLOSE;
}
