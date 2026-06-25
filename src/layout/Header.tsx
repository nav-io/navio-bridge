import { NavLink, Link } from 'react-router-dom';
import { Logo } from '../components/Logo';
import { ConnectButton } from '../components/ConnectButton';
import { NAVIO_NETWORK } from '../lib/contracts';

const navLinks = [
  { to: '/', label: 'Deposit' },
  { to: '/withdraw', label: 'Withdraw' },
  { to: '/audit', label: 'Audit' },
];

export function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-navy/80 backdrop-blur-xl">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-2">
        <Link to="/" className="flex items-center gap-2 shrink-0" aria-label="Navio Bridge">
          <Logo className="h-5 w-auto sm:h-6" />
          <span className="mono text-[10px] tracking-[0.22em] uppercase text-white/40 hidden sm:inline">bridge</span>
          {NAVIO_NETWORK === 'testnet' && (
            <span className="mono text-[9px] tracking-[0.2em] uppercase rounded-full border border-neon-pink/40 bg-neon-pink/10 text-neon-pink px-2 py-0.5">
              testnet
            </span>
          )}
        </Link>

        <nav className="flex items-center gap-0.5 rounded-full border border-white/10 bg-white/[0.03] p-0.5">
          {navLinks.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `px-2.5 sm:px-3.5 py-1 sm:py-1.5 text-[11px] sm:text-xs font-medium rounded-full transition-all ${
                  isActive ? 'text-white bg-white/10' : 'text-white/50 hover:text-white'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>

        <ConnectButton />
      </div>
    </header>
  );
}
