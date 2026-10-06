import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import BodegaDashboard, { PerfilProductosTab } from './pages/BodegaDashboard';
import MapaCliente from './pages/MapaCliente';
import BodegaPedidos from './pages/BodegaPedidos';
import BodegaReportes from './pages/BodegaReportes';
import SeguimientoPedido from './pages/SeguimientoPedido';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/mapa" element={<MapaCliente />} />
        <Route path="/pedido/:id/seguimiento" element={<SeguimientoPedido />} />
        <Route path="/bodega/dashboard" element={<BodegaDashboard />}>
          <Route index element={<PerfilProductosTab />} />
          <Route path="pedidos" element={<BodegaPedidos />} />
          <Route path="reportes" element={<BodegaReportes />} />
        </Route>
      </Routes>
    </Router>
  );
}