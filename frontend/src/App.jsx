import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import RequireAuth from './components/RequireAuth';

const BodegaDashboard = lazy(() => import('./pages/BodegaDashboard'));
const PerfilProductosTab = lazy(() =>
  import('./pages/BodegaDashboard').then((modulo) => ({
    default: modulo.PerfilProductosTab,
  }))
);
const MiTiendaTab = lazy(() =>
  import('./pages/BodegaDashboard').then((modulo) => ({
    default: modulo.MiTiendaTab,
  }))
);
const MapaCliente = lazy(() => import('./pages/MapaCliente'));
const TiendaPage = lazy(() => import('./pages/TiendaPage'));
const BodegaPedidos = lazy(() => import('./pages/BodegaPedidos'));
const BodegaReportes = lazy(() => import('./pages/BodegaReportes'));
const SeguimientoPedido = lazy(() => import('./pages/SeguimientoPedido'));
const MisPedidosPage = lazy(() => import('./pages/MisPedidosPage'));
const RecuperarPassword = lazy(() => import('./pages/RecuperarPassword'));

function CargandoPagina() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-cream-50">
      <div className="flex flex-col items-center gap-3 text-slate-500">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
        <p className="text-sm font-medium">Cargando...</p>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <Suspense fallback={<CargandoPagina />}>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/recuperar-password" element={<RecuperarPassword />} />
          <Route path="/mapa" element={<MapaCliente />} />
          <Route path="/tienda/:id" element={<TiendaPage />} />
          <Route
            path="/mis-pedidos"
            element={
              <RequireAuth roles={['CLIENTE']}>
                <MisPedidosPage />
              </RequireAuth>
            }
          />
          <Route
            path="/pedido/:id/seguimiento"
            element={
              <RequireAuth roles={['CLIENTE', 'BODEGUERO']}>
                <SeguimientoPedido />
              </RequireAuth>
            }
          />
          <Route
            path="/bodega/dashboard"
            element={
              <RequireAuth roles={['BODEGUERO']}>
                <BodegaDashboard />
              </RequireAuth>
            }
          >
            <Route index element={<PerfilProductosTab />} />
            <Route path="tienda" element={<MiTiendaTab />} />
            <Route path="pedidos" element={<BodegaPedidos />} />
            <Route path="reportes" element={<BodegaReportes />} />
          </Route>
        </Routes>
      </Suspense>
    </Router>
  );
}
