import { useEffect, useState } from 'react';
import {
  useAccount,
  useChainId,
  usePublicClient,
  useReadContracts,
  useWaitForTransactionReceipt,
  useWriteContract,
} from 'wagmi';
import { formatUnits } from 'viem';
import { Panel } from './Panel';
import {
  LEGACY_FARM_ABI,
  LEGACY_LIQUIDITY,
  LEGACY_PAIR_ABI,
  PANCAKE_ROUTER_ABI,
  TOKEN_ADDRESSES,
  TOKEN_NAME,
} from '../lib/contracts';

/** Max price movement tolerated between quote and removeLiquidity execution. */
const SLIPPAGE_BPS = 100n; // 1%
const DEADLINE_SECS = 20n * 60n;

type Step = 'unstake' | 'approve' | 'remove';

const fmt = (v: bigint, dec: number, digits = 4) =>
  Number(formatUnits(v, dec)).toLocaleString(undefined, { maximumFractionDigits: digits });

/**
 * Exit path for the legacy wNAV/BNB liquidity program: unstake LP from the old
 * farm, then remove liquidity on PancakeSwap so the wNAV lands in the wallet
 * and can be burned via the withdraw form below. Renders nothing for wallets
 * with no legacy position.
 */
export function LegacyLiquidity() {
  const { address } = useAccount();
  const chainId = useChainId();
  const cfg = LEGACY_LIQUIDITY[chainId];
  const token = TOKEN_ADDRESSES[chainId];
  const enabled = !!cfg && !!token && !!address;
  const publicClient = usePublicClient();
  const [emergency, setEmergency] = useState(false);

  const { data, refetch } = useReadContracts({
    allowFailure: false,
    contracts: enabled
      ? [
          { address: cfg.farm, abi: LEGACY_FARM_ABI, functionName: 'deposited', args: [cfg.pid, address] },
          { address: cfg.farm, abi: LEGACY_FARM_ABI, functionName: 'pending', args: [cfg.pid, address] },
          { address: cfg.lp, abi: LEGACY_PAIR_ABI, functionName: 'balanceOf', args: [address] },
          { address: cfg.lp, abi: LEGACY_PAIR_ABI, functionName: 'allowance', args: [address, cfg.router] },
          { address: cfg.lp, abi: LEGACY_PAIR_ABI, functionName: 'totalSupply' },
          { address: cfg.lp, abi: LEGACY_PAIR_ABI, functionName: 'token0' },
          { address: cfg.lp, abi: LEGACY_PAIR_ABI, functionName: 'getReserves' },
        ]
      : [],
    query: { enabled, refetchInterval: 15_000 },
  });

  const { writeContract, isPending, error, reset } = useWriteContract();
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const [step, setStep] = useState<Step | undefined>();
  const receipt = useWaitForTransactionReceipt({ hash: txHash });

  // Refresh positions once the tx lands; label/busy state derives from receipt.
  useEffect(() => {
    if (receipt.isSuccess || receipt.isError) refetch();
  }, [receipt.isSuccess, receipt.isError, refetch]);

  if (!enabled || !data) return null;

  const [farmed, pending, lpBal, allowance, lpSupply, token0, reserves] = data as unknown as [
    bigint, bigint, bigint, bigint, bigint, `0x${string}`, readonly [bigint, bigint, number],
  ];
  if (farmed === 0n && lpBal === 0n) return null;

  const navIs0 = token0.toLowerCase() === token.toLowerCase();
  const navReserve = navIs0 ? reserves[0] : reserves[1];
  const bnbReserve = navIs0 ? reserves[1] : reserves[0];
  const share = (lp: bigint, reserve: bigint) => (lpSupply > 0n ? (lp * reserve) / lpSupply : 0n);

  const busy = isPending || receipt.isLoading;
  const needsApproval = allowance < lpBal;

  async function send(s: Step) {
    if (!cfg || !address || !token) return;
    reset();
    setStep(s);
    const onSuccess = (h: `0x${string}`) => setTxHash(h);
    const onError = () => setStep(undefined);

    if (s === 'unstake') {
      // withdraw() also pays pending rewards and reverts if the farm can't
      // cover them. Simulate first; fall back to emergencyWithdraw(), which
      // returns the LP and forfeits rewards.
      let useEmergency = false;
      try {
        await publicClient?.simulateContract({
          account: address,
          address: cfg.farm,
          abi: LEGACY_FARM_ABI,
          functionName: 'withdraw',
          args: [cfg.pid, farmed],
        });
      } catch {
        useEmergency = true;
      }
      setEmergency(useEmergency);
      if (useEmergency) {
        writeContract(
          { address: cfg.farm, abi: LEGACY_FARM_ABI, functionName: 'emergencyWithdraw', args: [cfg.pid] },
          { onSuccess, onError },
        );
      } else {
        writeContract(
          { address: cfg.farm, abi: LEGACY_FARM_ABI, functionName: 'withdraw', args: [cfg.pid, farmed] },
          { onSuccess, onError },
        );
      }
    } else if (s === 'approve') {
      writeContract(
        { address: cfg.lp, abi: LEGACY_PAIR_ABI, functionName: 'approve', args: [cfg.router, lpBal] },
        { onSuccess, onError },
      );
    } else {
      const minNav = (share(lpBal, navReserve) * (10_000n - SLIPPAGE_BPS)) / 10_000n;
      const minBnb = (share(lpBal, bnbReserve) * (10_000n - SLIPPAGE_BPS)) / 10_000n;
      const deadline = BigInt(Math.floor(Date.now() / 1000)) + DEADLINE_SECS;
      writeContract(
        {
          address: cfg.router,
          abi: PANCAKE_ROUTER_ABI,
          functionName: 'removeLiquidityETH',
          args: [token, lpBal, minNav, minBnb, address, deadline],
        },
        { onSuccess, onError },
      );
    }
  }

  const label = (s: Step, idle: string) =>
    step === s && isPending ? 'Confirm in wallet…' : step === s && receipt.isLoading ? 'Waiting for block…' : idle;

  return (
    <Panel className="space-y-5">
      <div>
        <div className="mono text-[10px] tracking-[0.24em] uppercase text-neon-green">legacy liquidity found</div>
        <p className="mt-2 text-sm text-white/60">
          This wallet still has {TOKEN_NAME}/BNB liquidity from the old bridge program. Exit it here, then burn the
          freed {TOKEN_NAME} below.
        </p>
      </div>

      {farmed > 0n && (
        <div className="space-y-2 border-t border-white/5 pt-4">
          <div className="flex justify-between text-xs mono">
            <span className="text-white/40">1 · Staked in farm</span>
            <span className="text-white/80">
              ≈ {fmt(share(farmed, navReserve), 8)} {TOKEN_NAME} + {fmt(share(farmed, bnbReserve), 18)} BNB
            </span>
          </div>
          {pending > 0n && (
            <div className="flex justify-between text-xs mono">
              <span className="text-white/40">Unclaimed rewards</span>
              <span className="text-white/80">{fmt(pending, 8)} {TOKEN_NAME}</span>
            </div>
          )}
          <button type="button" onClick={() => send('unstake')} disabled={busy} className="neon-btn w-full">
            {label('unstake', 'Unstake from farm')}
          </button>
          {emergency && step === 'unstake' && (
            <p className="text-[11px] text-white/35">
              Normal unstake would fail; using emergency withdraw (LP returned, unclaimed rewards forfeited).
            </p>
          )}
        </div>
      )}

      {lpBal > 0n && (
        <div className="space-y-2 border-t border-white/5 pt-4">
          <div className="flex justify-between text-xs mono">
            <span className="text-white/40">{farmed > 0n ? '2' : '1'} · LP in wallet</span>
            <span className="text-white/80">
              ≈ {fmt(share(lpBal, navReserve), 8)} {TOKEN_NAME} + {fmt(share(lpBal, bnbReserve), 18)} BNB
            </span>
          </div>
          {needsApproval ? (
            <button type="button" onClick={() => send('approve')} disabled={busy} className="neon-btn w-full">
              {label('approve', 'Approve LP for PancakeSwap')}
            </button>
          ) : (
            <button type="button" onClick={() => send('remove')} disabled={busy} className="neon-btn w-full">
              {label('remove', 'Remove liquidity')}
            </button>
          )}
          <p className="text-[11px] text-white/35">
            Removes via PancakeSwap v2 router, 1% max slippage. You receive {TOKEN_NAME} and BNB.
          </p>
        </div>
      )}

      {error && <div className="text-xs text-neon-pink">{error.message.split('\n')[0]}</div>}
    </Panel>
  );
}
