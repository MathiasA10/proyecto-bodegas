import { Navigate, useLocation } from 'react-router-dom';

import { estaAutenticado, getRol } from '../utils/auth';

export default function RequireAuth({ children, roles }) {
  const location = useLocation();

  if (!estaAutenticado()) {
    return <Navigate to="/" replace state={{ from: location.pathname }} />;
  }

  if (roles && !roles.includes(getRol())) {
    return <Navigate to="/mapa" replace />;
  }

  return children;
}
