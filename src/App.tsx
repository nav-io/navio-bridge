import { Route, Routes } from 'react-router-dom';
import { Layout } from './layout/Layout';
import { DepositPage } from './pages/Deposit';
import { WithdrawPage } from './pages/Withdraw';
import { AuditPage } from './pages/Audit';
import { EmptyState } from './components/Panel';
import { SwapCountdown } from './components/SwapCountdown';
import { useSwapPhase } from './hooks/useSwapPhase';

/** Withdraw is unavailable until the swap window opens. */
function WithdrawRoute() {
  const { started, ready } = useSwapPhase();
  if (started) return <WithdrawPage />;
  return (
    <div className="space-y-4">
      <EmptyState>
        {ready
          ? 'Withdrawals open when the swap starts.'
          : 'Checking the swap window…'}
      </EmptyState>
      {ready && <SwapCountdown />}
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<DepositPage />} />
        <Route path="/withdraw" element={<WithdrawRoute />} />
        <Route path="/audit" element={<AuditPage />} />
        <Route path="*" element={<DepositPage />} />
      </Route>
    </Routes>
  );
}
