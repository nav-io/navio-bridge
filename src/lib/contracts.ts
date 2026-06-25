import type { Address } from 'viem';

export type NavioNetwork = 'mainnet' | 'testnet';

/**
 * Navio network selector. Drives:
 *   - NAV deposit address network prefix (N… on mainnet, m/n… on testnet)
 *   - Valid `note` address patterns for the withdraw burn
 *   - BLSCT chain parameters for the audit wallet
 *   - Navio network passed to NavioClient
 */
export const NAVIO_NETWORK: NavioNetwork =
  ((import.meta.env.VITE_NAVIO_NETWORK as string | undefined) || 'testnet') as NavioNetwork;

export const TOKEN_NAME = 'wNAV';
export const TOKEN_FULL_NAME = 'Wrapped Navcoin';
export const WITHDRAWAL_FEE = 0;

export const TOKEN_ADDRESSES: Record<number, Address> = {
  56: '0xbfef6ccfc830d3baca4f6766a0d4aaa242ca9f3d',
};

export const BRIDGE_CONFIG = {
  publicKeyNav:
    'xpub661MyMwAqRbcGU4zstehr61rwbDzTBkZpKaWhXXEiZcNY9HYaEutrSqB4c8m2eh7Z77ggyVxdeSPXNYeN3Ns16BUh3cBwHJPAjASCfVusFK',
  feeMint: 1.25,
  navConfirmations: 1,
  defaultNavFee: 100000,
};

/** Block at which the wNAV BEP-20 contract was deployed. Used to scope getLogs queries. */
export const WNAV_DEPLOY_BLOCK: Record<number, bigint> = {
  56: 8_300_000n,
};

/**
 * Navio bridge payout ("genesis") address. All wNAV burns are paid from this
 * wallet, so its outgoing tx history plus current balance form the public audit.
 */
export const AUDIT_CONFIG = {
  genesisAddress:
    (import.meta.env.VITE_AUDIT_GENESIS_ADDRESS as string | undefined) ||
    'navio1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq',
  /**
   * BLSCT audit key published by the bridge operator: 32-byte private view key
   * concatenated with the 48-byte public spending key (80 bytes, hex-encoded).
   * Lets anyone sync the wallet read-only and verify outgoing flows.
   */
  auditKey: (import.meta.env.VITE_AUDIT_KEY as string | undefined) || '',
  /** Navio wallet DB name (IndexedDB). */
  walletDbName: 'navio-audit-wallet',
  /** Electrum server used for read-only sync. */
  electrum: {
    host:
      (import.meta.env.VITE_NAVIO_ELECTRUM_HOST as string | undefined) ||
      'testnet.nav.io',
    port: Number(import.meta.env.VITE_NAVIO_ELECTRUM_PORT ?? 50005),
    ssl: (import.meta.env.VITE_NAVIO_ELECTRUM_SSL ?? 'true') !== 'false',
  },
  /** Height at which the bridge wallet was created — avoids genesis scan. */
  restoreFromHeight: Number(import.meta.env.VITE_AUDIT_RESTORE_HEIGHT ?? 0),
  /** Navio network (mirrors NAVIO_NETWORK). */
  network: NAVIO_NETWORK,
};

export const TOKEN_ABI = [
  { inputs: [], name: 'decimals', outputs: [{ type: 'uint8' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'name', outputs: [{ type: 'string' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'symbol', outputs: [{ type: 'string' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'totalSupply', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  { inputs: [], name: 'register', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  {
    inputs: [{ name: '_native', type: 'address' }],
    name: 'isRegistered',
    outputs: [{ type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: '_value', type: 'uint256' },
      { name: '_note', type: 'string' },
    ],
    name: 'burnWithNote',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  { inputs: [], name: 'getMinFee', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'getFeeAddress', outputs: [{ type: 'address' }], stateMutability: 'view', type: 'function' },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'a', type: 'address' },
      { indexed: false, name: 'v', type: 'uint256' },
      { indexed: false, name: 'n', type: 'string' },
    ],
    name: 'BurnedWithNote',
    type: 'event',
  },
] as const;
