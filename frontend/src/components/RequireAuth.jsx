import { Navigate, useLocation } from 'react-router-dom';

import { useAuth } from '../hooks/useAuth';

function CargandoSesion() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-cream-50">
      <div className="flex flex-col items-center gap-3 text-slate-500">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
        <p className="text-sm font-medium">Verificando sesión...</p>
      </div>
    </div>
  );
}

export default function RequireAuth({ children, roles }) {
  const location = useLocation();
  const { usuario, cargando } = useAuth();

  if (cargando) {
    return <CargandoSesion />;
  }

  if (!usuario) {
    return <Navigate to="/" replace state={{ from: location.pathname }} />;
  }

  if (roles && !roles.includes(usuario.rol)) {
    return <Navigate to="/mapa" replace />;
  }

  return children;
}
