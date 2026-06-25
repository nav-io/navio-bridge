import { Route, Routes } from 'react-router-dom';
import { Layout } from './layout/Layout';
import { DepositPage } from './pages/Deposit';
import { WithdrawPage } from './pages/Withdraw';
import { AuditPage } from './pages/Audit';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<DepositPage />} />
        <Route path="/withdraw" element={<WithdrawPage />} />
        <Route path="/audit" element={<AuditPage />} />
        <Route path="*" element={<DepositPage />} />
      </Route>
    </Routes>
  );
}
