const METODOS_PAGO = {
  YAPE: 'Yape',
  PLIN: 'Plin',
  CONTRA_ENTREGA: 'Contra entrega',
};

export function formatearMetodoPago(metodo) {
  return METODOS_PAGO[metodo] || metodo || '';
}

export function formatearMoneda(valor) {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN',
  }).format(Number(valor) || 0);
}
