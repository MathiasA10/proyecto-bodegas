const TELEFONO_PERU = /^9\d{8}$/;

export function normalizarTelefono(valor) {
  let digitos = String(valor ?? '').replace(/\D/g, '');
  if (digitos.startsWith('51') && digitos.length > 9) {
    digitos = digitos.slice(2);
  }
  return digitos.slice(0, 9);
}

export function esTelefonoValido(valor) {
  return TELEFONO_PERU.test(normalizarTelefono(valor));
}
