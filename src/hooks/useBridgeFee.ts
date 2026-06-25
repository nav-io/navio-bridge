import { useEffect, useState } from 'react';
import { useChainId, usePublicClient } from 'wagmi';
import { formatEther } from 'viem';

/** Approx gas used by the bridge mint() tx on BSC (old wnav-react constant). */
const MINT_GAS_UNITS = 107_552n;
const BLOCKS_API = import.meta.env.VITE_BLOCKS_API_URL || 'https://blocks.nav.io';
const CG_BNB_URL = 'https://api.coingecko.com/api/v3/simple/price?ids=binancecoin&vs_currencies=usd';

interface BridgeFee {
  navAmount: number | null;
  gasPriceGwei: number | null;
  bnbUsd: number | null;
  navUsd: number | null;
  loading: boolean;
  error: string | null;
}

export function useBridgeFee(): BridgeFee {
  const chainId = useChainId();
  const client = usePublicClient({ chainId });
  const [nonce, setNonce] = useState(0);

  const [state, setState] = useState<BridgeFee>({
    navAmount: null,
    gasPriceGwei: null,
    bnbUsd: null,
    navUsd: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!client) return;
    let cancelled = false;

    (async () => {
      setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const [gasPrice, bnb, nav] = await Promise.all([
          client.getGasPrice(),
          fetch(CG_BNB_URL).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`BNB ${r.status}`)))),
          fetch(`${BLOCKS_API}/api/price`).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`NAV ${r.status}`)))),
        ]);
        if (cancelled) return;

        const bnbUsd = Number(bnb?.binancecoin?.usd);
        const navUsd = Number(nav?.price_usd);
        const gasBnb = Number(formatEther(MINT_GAS_UNITS * gasPrice));
        const gasUsd = gasBnb * bnbUsd;
        const navAmount = navUsd > 0 ? gasUsd / navUsd : null;

        setState({
          navAmount,
          gasPriceGwei: Number(gasPrice) / 1e9,
          bnbUsd,
          navUsd,
          loading: false,
          error: null,
        });
      } catch (err) {
        if (!cancelled) {
          setState((s) => ({ ...s, loading: false, error: (err as Error).message }));
        }
      }
    })();

    const timer = setInterval(() => {
      if (!cancelled) setNonce((n) => n + 1);
    }, 120_000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [client, nonce]);

  return state;
}
