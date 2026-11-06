import { useCallback, useEffect, useMemo, useState } from 'react';

import api, { getAccessToken, setAccessToken } from '../api/client';
import { AuthContext } from './authContext';

const STORAGE_KEYS = {
  rol: 'user_rol',
  nombre: 'user_nombre',
  id: 'user_id',
};

function leerUsuarioGuardado() {
  const id = localStorage.getItem(STORAGE_KEYS.id);
  const rol = localStorage.getItem(STORAGE_KEYS.rol);
  if (!id || !rol) return null;
  return {
    id,
    rol,
    nombre: localStorage.getItem(STORAGE_KEYS.nombre) || '',
  };
}

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(leerUsuarioGuardado);
  const [cargando, setCargando] = useState(Boolean(leerUsuarioGuardado()));

  const limpiarSesion = useCallback(() => {
    setAccessToken(null);
    Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
    setUsuario(null);
    setCargando(false);
  }, []);

  useEffect(() => {
    let cancelado = false;

    async function restaurarSesion() {
      if (!usuario) {
        setCargando(false);
        return;
      }
      if (getAccessToken()) {
        setCargando(false);
        return;
      }

      try {
        const res = await api.post('auth/refresh/');
        if (!cancelado) {
          setAccessToken(res.data.access);
          setCargando(false);
        }
      } catch {
        if (!cancelado) limpiarSesion();
      }
    }

    restaurarSesion();
    return () => {
      cancelado = true;
    };
  }, [usuario, limpiarSesion]);

  useEffect(() => {
    window.addEventListener('auth:logout', limpiarSesion);
    return () => window.removeEventListener('auth:logout', limpiarSesion);
  }, [limpiarSesion]);

  const iniciarSesion = useCallback(async (credenciales) => {
    const res = await api.post('auth/login/', credenciales);
    setAccessToken(res.data.access);

    const sesion = {
      id: res.data.id,
      rol: res.data.rol,
      nombre: res.data.nombre || '',
    };
    localStorage.setItem(STORAGE_KEYS.id, sesion.id);
    localStorage.setItem(STORAGE_KEYS.rol, sesion.rol);
    localStorage.setItem(STORAGE_KEYS.nombre, sesion.nombre);
    setUsuario(sesion);
    setCargando(false);
    return res.data;
  }, []);

  const cerrarSesion = useCallback(async () => {
    try {
      await api.post('auth/logout/');
    } catch {
      // La cookie se elimina igualmente en el cliente.
    } finally {
      limpiarSesion();
    }
  }, [limpiarSesion]);

  const value = useMemo(
    () => ({
      usuario,
      cargando,
      iniciarSesion,
      cerrarSesion,
      estaAutenticado: Boolean(usuario),
    }),
    [usuario, cargando, iniciarSesion, cerrarSesion]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
