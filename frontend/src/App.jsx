import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import BodegaDashboard, { MiTiendaTab, PerfilProductosTab } from './pages/BodegaDashboard';
import MapaCliente from './pages/MapaCliente';
import TiendaPage from './pages/TiendaPage';
import BodegaPedidos from './pages/BodegaPedidos';
import BodegaReportes from './pages/BodegaReportes';
import SeguimientoPedido from './pages/SeguimientoPedido';
import MisPedidosPage from './pages/MisPedidosPage';
import RecuperarPassword from './pages/RecuperarPassword';
import RequireAuth from './components/RequireAuth';

export default function App() {
  return (
    <Router>
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
    </Router>
  );
}
