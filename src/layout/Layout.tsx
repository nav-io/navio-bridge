import { Outlet, useLocation } from 'react-router-dom';
import { Header } from './Header';
import { Footer } from './Footer';

export function Layout() {
  const { pathname } = useLocation();
  const wide = pathname.startsWith('/audit');
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-1 grid-bg pt-28 sm:pt-36 pb-16 sm:pb-24 px-5 sm:px-6 flex items-start justify-center">
        <div className={`w-full ${wide ? 'max-w-4xl' : 'max-w-md sm:max-w-xl'}`}>
          <Outlet />
        </div>
      </main>
      <Footer />
    </div>
  );
}
