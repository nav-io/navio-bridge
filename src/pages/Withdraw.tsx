import { useMemo, useState } from 'react';
import { useAccount, useChainId, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { formatUnits, parseUnits } from 'viem';
import { EmptyState, Panel } from '../components/Panel';
import { Intro } from '../components/Intro';
import { TOKEN_ABI, TOKEN_ADDRESSES, TOKEN_NAME, WITHDRAWAL_FEE } from '../lib/contracts';
import { examplePlaceholder, isValidNavioAddress } from '../lib/deriveNavAddress';

export function WithdrawPage() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const token = TOKEN_ADDRESSES[chainId];

  const [dest, setDest] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();

  const { data: balance } = useReadContract({
    address: token,
    abi: TOKEN_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: isConnected && !!token && !!address, refetchInterval: 12_000 },
  });
  const { data: decimals } = useReadContract({
    address: token,
    abi: TOKEN_ABI,
    functionName: 'decimals',
    query: { enabled: !!token },
  });
  const dec = typeof decimals === 'number' ? decimals : 8;
  const balanceNum = balance ? Number(formatUnits(balance as bigint, dec)) : 0;
  const amountNum = parseFloat(amountStr) || 0;

  const { writeContract, isPending, reset, error } = useWriteContract();
  const receipt = useWaitForTransactionReceipt({ hash: txHash });

  const addrValid = dest.length === 0 || isValidNavioAddress(dest);
  const amountValid = amountStr.length === 0 || (amountNum > 0 && amountNum <= balanceNum);
  const canSubmit =
    isConnected && !!token && dest.length > 0 && amountNum > 0 && addrValid && amountValid &&
    !isPending && !receipt.isLoading;

  const receive = useMemo(() => Math.max(0, amountNum - WITHDRAWAL_FEE), [amountNum]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || !token) return;
    writeContract(
      {
        address: token,
        abi: TOKEN_ABI,
        functionName: 'burnWithNote',
        args: [parseUnits(amountStr, dec), dest.trim()],
      },
      { onSuccess: (h) => setTxHash(h) },
    );
  }

  if (!isConnected) return <Intro />;
  if (!token) return <EmptyState tone="warn">Switch to BNB Smart Chain.</EmptyState>;

  if (receipt.isSuccess) {
    return (
      <Panel>
        <div className="mono text-[10px] tracking-[0.24em] uppercase text-neon-green">burn confirmed</div>
        <div className="mt-2 mono text-[11px] sm:text-xs break-all text-white/70">{txHash}</div>
        <button
          onClick={() => { setDest(''); setAmountStr(''); setTxHash(undefined); reset(); }}
          className="ghost-btn mt-4"
        >
          New withdrawal
        </button>
      </Panel>
    );
  }

  return (
    <Panel className="!p-0">
    <form onSubmit={onSubmit} className="p-6 sm:p-8 space-y-6">
      <div>
        <div className="mb-1.5 mono text-[10px] tracking-[0.2em] uppercase text-white/45">Navio address</div>
        <input
          type="text"
          value={dest}
          onChange={(e) => setDest(e.target.value)}
          placeholder={examplePlaceholder()}
          className={`field ${!addrValid ? 'invalid' : ''}`}
          spellCheck={false}
          autoComplete="off"
        />
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <span className="mono text-[10px] tracking-[0.2em] uppercase text-white/45">Amount</span>
          <button
            type="button"
            onClick={() => setAmountStr(String(balanceNum))}
            disabled={!balanceNum}
            className="mono text-[10px] tracking-[0.15em] uppercase text-white/40 hover:text-white disabled:opacity-30"
          >
            max · {balanceNum.toLocaleString(undefined, { maximumFractionDigits: 4 })}
          </button>
        </div>
        <input
          type="number"
          min="0"
          step="any"
          inputMode="decimal"
          value={amountStr}
          onChange={(e) => setAmountStr(e.target.value)}
          placeholder="0.0"
          className={`field ${!amountValid ? 'invalid' : ''}`}
        />
      </div>

      <div className="text-xs mono flex justify-between border-t border-white/5 pt-3">
        <span className="text-white/40">You receive</span>
        <span className="gradient-text font-semibold">
          {receive.toLocaleString(undefined, { maximumFractionDigits: 8 })} NAVIO
        </span>
      </div>

      {error && (
        <div className="text-xs text-neon-pink">{error.message.split('\n')[0]}</div>
      )}

      <button type="submit" disabled={!canSubmit} className="neon-btn w-full">
        {isPending ? 'Confirm in wallet…' : receipt.isLoading ? 'Waiting for block…' : `Burn ${TOKEN_NAME}`}
      </button>
    </form>
    </Panel>
  );
}
