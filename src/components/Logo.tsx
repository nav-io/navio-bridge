export function Logo({ className = 'h-7 w-auto', full = false }: { className?: string; full?: boolean }) {
  return (
    <img
      src={full ? '/navio-logo.svg' : '/navio-mark.svg'}
      alt="Navio"
      className={`${className} drop-shadow-[0_2px_8px_rgba(79,179,255,0.25)]`}
      loading="eager"
      decoding="async"
    />
  );
}
