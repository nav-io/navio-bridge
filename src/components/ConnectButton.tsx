import { ConnectButton as RKConnectButton } from '@rainbow-me/rainbowkit';

export function ConnectButton() {
  return (
    <RKConnectButton.Custom>
      {({ account, chain, openAccountModal, openChainModal, openConnectModal, mounted }) => {
        const ready = mounted;
        const connected = ready && account && chain;

        return (
          <div
            className="flex items-center gap-1.5 shrink-0"
            {...(!ready && {
              'aria-hidden': true,
              style: { opacity: 0, pointerEvents: 'none', userSelect: 'none' },
            })}
          >
            {!connected ? (
              <button onClick={openConnectModal} className="neon-btn !px-3 !py-1.5 !text-xs whitespace-nowrap">
                <span className="neon-dot h-1.5 w-1.5" />
                <span className="hidden sm:inline">Connect wallet</span>
                <span className="sm:hidden">Connect</span>
              </button>
            ) : chain.unsupported ? (
              <button
                onClick={openChainModal}
                className="neon-btn !px-3 !py-1.5 !text-xs whitespace-nowrap !bg-[rgba(242,93,156,0.18)]"
              >
                Wrong net
              </button>
            ) : (
              <>
                <button
                  onClick={openChainModal}
                  className="ghost-btn !px-2 !py-1.5 !text-xs hidden sm:inline-flex"
                  aria-label="Switch network"
                >
                  {chain.hasIcon && chain.iconUrl && (
                    <img src={chain.iconUrl} alt="" className="h-4 w-4 rounded-full" />
                  )}
                  <span>{chain.name}</span>
                </button>
                <button onClick={openAccountModal} className="neon-btn !px-3 !py-1.5 !text-xs whitespace-nowrap">
                  <span className="mono">{shortAddr(account.address)}</span>
                </button>
              </>
            )}
          </div>
        );
      }}
    </RKConnectButton.Custom>
  );
}

function shortAddr(a?: string) {
  if (!a) return '';
  return `${a.slice(0, 4)}…${a.slice(-4)}`;
}
