import { Navigate, Route, Routes } from 'react-router-dom';
import { useSafeGate } from './lib/store';
import Login from './pages/Login';
import DispatcherDashboard from './pages/DispatcherDashboard';
import RiderApp from './pages/RiderApp';
import Credentials from './pages/Credentials';
import Audit from './pages/Audit';
import Layout from './components/Layout';

function RequireRole({ allowed, children }: { allowed: string; children: React.ReactNode }) {
  const { session } = useSafeGate();
  if (!session) return <Navigate to="/" replace />;
  if (session.role !== allowed) return <Navigate to={session.role === 'rider' ? '/rider' : '/dispatcher'} replace />;
  return <>{children}</>;
}

export default function App() {
  const { session } = useSafeGate();

  return (
    <Routes>
      <Route path="/" element={session ? <Navigate to={session.role === 'rider' ? '/rider' : '/dispatcher'} replace /> : <Login />} />

      <Route
        element={
          <RequireRole allowed="dispatcher">
            <Layout />
          </RequireRole>
        }
      >
        <Route path="/dispatcher" element={<DispatcherDashboard />} />
        <Route path="/credentials" element={<Credentials />} />
        <Route path="/audit" element={<Audit />} />
      </Route>

      <Route
        path="/rider"
        element={
          <RequireRole allowed="rider">
            <RiderApp />
          </RequireRole>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}