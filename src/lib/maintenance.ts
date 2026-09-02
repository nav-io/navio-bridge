// Bridge maintenance switch.
//
// Network upgrade complete (mainnet proof-v2 active, watchtower minting v2):
// swaps re-enabled by default. Set VITE_SWAPS_DISABLED=true (or flip the default
// back to 'true') for the next upgrade window — while disabled the frontend
// shows a banner and disables the swap actions so users don't submit burns that
// cannot be forwarded.
export const SWAPS_DISABLED =
  (import.meta.env.VITE_SWAPS_DISABLED ?? 'false') !== 'false';

export const SWAPS_DISABLED_MESSAGE =
  'Swaps are temporarily disabled while the Navio network completes a scheduled upgrade. Your funds are safe — please check back shortly.';
