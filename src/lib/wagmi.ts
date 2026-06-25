import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { bsc } from 'wagmi/chains';
import { http } from 'viem';

const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || '2f05a7cde4d1a04c6b7c76c3e9d1b7c5';

export const wagmiConfig = getDefaultConfig({
  appName: 'Navio Bridge',
  projectId,
  chains: [bsc],
  transports: {
    [bsc.id]: http(),
  },
  ssr: false,
});

export const SUPPORTED_CHAINS = [bsc.id] as const;
export type SupportedChainId = (typeof SUPPORTED_CHAINS)[number];
