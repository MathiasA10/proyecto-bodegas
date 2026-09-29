import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import RegisterBodeguero from './pages/RegisterBodeguero';
import BodegaDashboard from './pages/BodegaDashboard';
import MapaCliente from './pages/MapaCliente';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/registro-bodeguero" element={<RegisterBodeguero />} />
        <Route path="/bodega/dashboard" element={<BodegaDashboard />} />
        <Route path="/mapa" element={<MapaCliente />} />
      </Routes>
    </Router>
  );
}