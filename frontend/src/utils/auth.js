export function getToken() {
  return localStorage.getItem('access_token');
}

export function getRol() {
  return localStorage.getItem('user_rol');
}

export function getNombre() {
  return localStorage.getItem('user_nombre') || '';
}

export function getUsuarioId() {
  return localStorage.getItem('user_id');
}

export function estaAutenticado() {
  return Boolean(getToken());
}

export function cerrarSesion() {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('user_rol');
  localStorage.removeItem('user_nombre');
  localStorage.removeItem('user_id');
}
