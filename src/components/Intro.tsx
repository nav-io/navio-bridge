import { ConnectButton } from '@rainbow-me/rainbowkit';
import { SwapCountdown } from './SwapCountdown';
import { examplePlaceholder } from '../lib/deriveNavAddress';

export function Intro() {
  return (
    <div className="space-y-10">
      <div className="text-center space-y-4">
        <div className="mono text-[10px] tracking-[0.3em] uppercase text-neon-blue/80 inline-flex items-center gap-2">
          <span className="neon-dot h-1.5 w-1.5" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-semibold leading-tight">
          <span className="gradient-text">Wrap NAV.</span>{' '}
          <span className="text-white/90">Cross to Navio.</span>
        </h1>
        <p className="text-sm text-white/55 max-w-md mx-auto">
          Navio is the next-generation chain succeeding Navcoin — confidential by
          default, secured by Proof of Private Stake. This bridge migrates legacy{' '}
          <span className="mono text-white/80">NAV</span> to native{' '}
          <span className="mono text-white/80">NAVIO</span>.
        </p>
      </div>

      <SwapCountdown />

      <div className="grid gap-4">
        <Step
          n="01"
          title="Wrap"
          body="Send legacy NAV to a unique bridge address. Receive wNAV (BEP-20) on BNB Smart Chain."
          accent="blue"
        />
        <Arrow />
        <Step
          n="02"
          title="Burn to Navio"
          body={`Burn wNAV with your ${examplePlaceholder()} address as the note. The bridge credits native NAVIO.`}
          accent="pink"
        />
      </div>

      <div className="flex justify-center pt-4">
        <ConnectButton.Custom>
          {({ openConnectModal, mounted }) => (
            <button
              onClick={openConnectModal}
              className="neon-btn"
              style={mounted ? undefined : { opacity: 0, pointerEvents: 'none' }}
            >
              <span className="neon-dot h-1.5 w-1.5" />
              Connect wallet to begin
            </button>
          )}
        </ConnectButton.Custom>
      </div>

      <div className="text-center mono text-[10px] tracking-[0.18em] uppercase text-white/30">
        <a href="https://nav.io" target="_blank" rel="noreferrer" className="hover:text-white/60 transition-colors">
          learn more · nav.io ↗
        </a>
      </div>
    </div>
  );
}

function Step({
  n,
  title,
  body,
  accent,
}: {
  n: string;
  title: string;
  body: string;
  accent: 'blue' | 'purple' | 'pink';
}) {
  const ring = {
    blue: 'ring-neon-blue/40 text-neon-blue shadow-[0_0_18px_rgba(79,179,255,0.25)]',
    purple: 'ring-neon-purple/40 text-neon-purple shadow-[0_0_18px_rgba(124,126,255,0.25)]',
    pink: 'ring-neon-pink/40 text-neon-pink shadow-[0_0_18px_rgba(242,93,156,0.25)]',
  }[accent];

  return (
    <div className="glow-card !p-5 flex items-start gap-4">
      <div
        className={`shrink-0 mono text-[11px] font-semibold h-8 w-8 rounded-full ring-1 ${ring} bg-black/40 flex items-center justify-center`}
      >
        {n}
      </div>
      <div className="min-w-0">
        <div className="text-sm font-medium text-white">{title}</div>
        <div className="mt-0.5 text-xs text-white/55 leading-relaxed">{body}</div>
      </div>
    </div>
  );
}

function Arrow() {
  return (
    <div className="flex justify-center text-white/25 mono text-xs -my-1">↓</div>
  );
}
