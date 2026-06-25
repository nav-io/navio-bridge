import { useEffect, useMemo, useState } from 'react';
import QRCodeNS from 'react-qr-code';
const QRCode: typeof import('react-qr-code').default =
  (QRCodeNS as unknown as { default: typeof QRCodeNS }).default ?? QRCodeNS;
import { useAccount, useChainId, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { CopyButton } from '../components/CopyButton';
import { EmptyState, Panel } from '../components/Panel';
import { Intro } from '../components/Intro';
import { TOKEN_ABI, TOKEN_ADDRESSES, BRIDGE_CONFIG } from '../lib/contracts';
import { useBridgeFee } from '../hooks/useBridgeFee';
import { SwapCountdown } from '../components/SwapCountdown';
import { deriveNavDepositAddress } from '../lib/deriveNavAddress';

export function DepositPage() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const token = TOKEN_ADDRESSES[chainId];
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();

  const {
    data: registered,
    isLoading: regLoading,
    refetch,
  } = useReadContract({
    address: token,
    abi: TOKEN_ABI,
    functionName: 'isRegistered',
    args: address ? [address] : undefined,
    query: { enabled: isConnected && !!token && !!address, refetchInterval: 5_000 },
  });

  const { writeContract, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  useEffect(() => {
    if (isSuccess) refetch();
  }, [isSuccess, refetch]);

  const fee = useBridgeFee();

  const navAddress = useMemo(() => {
    if (!address || !token) return '';
    try {
      return deriveNavDepositAddress(address, chainId);
    } catch {
      return '';
    }
  }, [address, chainId, token]);

  if (!isConnected) return <Intro />;
  if (!token) return <EmptyState tone="warn">Switch to BNB Smart Chain.</EmptyState>;

  if (regLoading || registered === undefined) {
    return (
      <Panel className="text-center">
        <div className="mono text-[10px] tracking-[0.24em] uppercase text-white/40">
          checking registration…
        </div>
      </Panel>
    );
  }

  if (registered !== true) {
    const waiting = isPending || isConfirming;
    return (
      <Panel className="text-center">
        <p className="text-sm text-white/60">
          Register your wallet once to generate a NAV deposit address.
        </p>
        <button
          onClick={() =>
            writeContract(
              { address: token, abi: TOKEN_ABI, functionName: 'register' },
              { onSuccess: (h) => setTxHash(h) },
            )
          }
          disabled={waiting}
          className="neon-btn w-full mt-4"
        >
          {waiting ? (isConfirming ? 'Waiting for confirmation…' : 'Confirm in wallet…') : 'Register'}
        </button>
        {waiting && (
          <p className="mt-3 mono text-[10px] tracking-[0.22em] uppercase text-white/35">
            address unlocks after on-chain confirmation
          </p>
        )}
      </Panel>
    );
  }

  if (!navAddress) return null;

  return (
    <div className="space-y-4">
    <SwapCountdown />
    <Panel>
      <div className="flex items-center justify-center mb-8">
        <div className="rounded-xl bg-white p-3">
          <QRCode
            value={`navcoin:${navAddress}`}
            size={184}
            bgColor="#ffffff"
            fgColor="#080D1F"
            style={{ maxWidth: '100%', height: 'auto', width: '184px' }}
          />
        </div>
      </div>

      <div className="rounded-lg border border-white/10 bg-black/30 p-4 mono text-[11px] sm:text-xs break-all text-neon-blue text-center">
        {navAddress}
      </div>

      <div className="mt-4 flex flex-wrap gap-2 justify-center">
        <CopyButton text={navAddress} />
        <a href={`navcoin:${navAddress}`} className="ghost-btn !px-3 !py-1.5 !text-xs">Open wallet</a>
      </div>

      <div className="mt-8 pt-5 border-t border-white/5 text-xs text-white/45 space-y-1.5 mono">
        <Row
          label="Fee"
          value={
            fee.navAmount !== null
              ? `~${fee.navAmount.toFixed(2)} NAV`
              : fee.error
                ? `~${BRIDGE_CONFIG.feeMint.toFixed(2)} NAV`
                : '…'
          }
          hint={
            fee.navAmount !== null && fee.gasPriceGwei !== null
              ? `${(107552).toLocaleString()} gas × ${fee.gasPriceGwei.toFixed(2)} gwei · BNB $${fee.bnbUsd?.toFixed(2)} · NAV $${fee.navUsd?.toFixed(4)}`
              : undefined
          }
        />
      </div>
    </Panel>
    </div>
  );
}

function Row({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <div className="flex justify-between">
        <span className="text-white/35">{label}</span>
        <span className="text-white/70">{value}</span>
      </div>
      {hint && <div className="mt-0.5 text-[9px] tracking-wide text-white/25 text-right">{hint}</div>}
    </div>
  );
}
