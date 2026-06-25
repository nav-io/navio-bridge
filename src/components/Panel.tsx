import type { ReactNode } from 'react';

export function Panel({
  children,
  tone,
  className = '',
}: {
  children: ReactNode;
  tone?: 'warn';
  className?: string;
}) {
  return (
    <div
      className={`glow-card ${
        tone === 'warn' ? '!border-neon-pink/30' : ''
      } ${className}`}
    >
      {children}
    </div>
  );
}

export function EmptyState({ children, tone }: { children: ReactNode; tone?: 'warn' }) {
  return (
    <Panel tone={tone} className="text-center">
      <p className={`text-sm ${tone === 'warn' ? 'text-neon-pink' : 'text-white/60'}`}>{children}</p>
    </Panel>
  );
}
