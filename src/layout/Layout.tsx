import { Outlet, useLocation } from 'react-router-dom';
import { Header } from './Header';
import { Footer } from './Footer';
import { SWAPS_DISABLED, SWAPS_DISABLED_MESSAGE } from '../lib/maintenance';

export function Layout() {
  const { pathname } = useLocation();
  const wide = pathname.startsWith('/audit');
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      {SWAPS_DISABLED && (
        <div
          role="alert"
          className="fixed top-20 sm:top-24 inset-x-0 z-40 bg-amber-500/15 border-y border-amber-500/40 text-amber-200 text-xs sm:text-sm text-center px-4 py-2.5"
        >
          {SWAPS_DISABLED_MESSAGE}
        </div>
      )}
      <main className="flex-1 grid-bg pt-28 sm:pt-36 pb-16 sm:pb-24 px-5 sm:px-6 flex items-start justify-center">
        <div className={`w-full ${wide ? 'max-w-4xl' : 'max-w-md sm:max-w-xl'}`}>
          <Outlet />
        </div>
      </main>
      <Footer />
    </div>
  );
}
