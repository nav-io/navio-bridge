// @ts-expect-error — bitcore-lib has no types
import Bitcore from '@aguycalled/bitcore-lib';
import { BRIDGE_CONFIG, NAVIO_NETWORK, TOKEN_ADDRESSES } from './contracts';

/**
 * Derive the deterministic NAV deposit address for a registered EVM wallet.
 * Uses the bridge xpub so the same path from the operator side produces the
 * same key — avoids any backend lookup. The `mainnet`/`testnet` flag toggles
 * base58 version bytes (N… vs m/n…).
 */
export function deriveNavDepositAddress(evmAddress: string, chainId: number): string {
  const token = TOKEN_ADDRESSES[chainId];
  if (!token) throw new Error(`Unsupported chain ${chainId}`);

  const addr = evmAddress.toLowerCase();
  const chainStr = String(chainId);
  const pad = chainStr.length % 2 ? '0' : '';
  const path = addr + chainStr + pad + token.substring(2);

  const network = NAVIO_NETWORK === 'testnet' ? 'testnet' : 'mainnet';
  const nav = Bitcore.HDPublicKey(BRIDGE_CONFIG.publicKeyNav).deriveChild(path).publicKey.toAddress(network);
  return nav.toString();
}

/** BLSCT bech32m prefix for the active network. */
const BECH_PREFIX: Record<'mainnet' | 'testnet', string> = {
  mainnet: 'nav1',
  testnet: 'tnv1',
};

export function navioAddressPrefix(): string {
  return BECH_PREFIX[NAVIO_NETWORK];
}

export function isValidNavioAddress(addr: string): boolean {
  if (!addr) return false;
  const lower = addr.trim().toLowerCase();
  const prefix = BECH_PREFIX[NAVIO_NETWORK];
  return (
    lower.startsWith(prefix) &&
    /^[a-z0-9]+$/.test(lower) &&
    lower.length >= prefix.length + 10
  );
}

/** UI placeholder: e.g. `nav1…` / `tnv1…`. */
export function examplePlaceholder(): string {
  return `${BECH_PREFIX[NAVIO_NETWORK]}…`;
}
