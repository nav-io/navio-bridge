// Bridge maintenance switch.
//
// Set to false (or VITE_SWAPS_DISABLED=false) once the Navio network upgrade
// completes and the watchtower is minting v2 again. While true, the frontend
// shows a banner and disables the swap actions so users don't submit burns
// that cannot be forwarded during the upgrade window.
export const SWAPS_DISABLED =
  (import.meta.env.VITE_SWAPS_DISABLED ?? 'true') !== 'false';

export const SWAPS_DISABLED_MESSAGE =
  'Swaps are temporarily disabled while the Navio network completes a scheduled upgrade. Your funds are safe — please check back shortly.';
