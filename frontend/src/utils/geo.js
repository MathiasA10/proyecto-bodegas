const RADIO_TIERRA_KM = 6371;

export const LIMA_CENTRO = [-12.046374, -77.042793];

export function calcularDistanciaKm(lat1, lon1, lat2, lon2) {
  const valores = [lat1, lon1, lat2, lon2].map(Number);

  if (valores.some((valor) => !Number.isFinite(valor))) {
    return null;
  }

  const [a1, o1, a2, o2] = valores;
  const aRadianes1 = (a1 * Math.PI) / 180;
  const aRadianes2 = (a2 * Math.PI) / 180;
  const deltaLat = ((a2 - a1) * Math.PI) / 180;
  const deltaLon = ((o2 - o1) * Math.PI) / 180;

  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(aRadianes1) * Math.cos(aRadianes2) * Math.sin(deltaLon / 2) ** 2;

  return 2 * RADIO_TIERRA_KM * Math.asin(Math.sqrt(a));
}

export function formatearDistancia(km) {
  if (km === null || km === undefined || !Number.isFinite(Number(km))) {
    return 'Distancia no disponible';
  }

  const valor = Number(km);

  if (valor < 1) {
    return `${Math.round(valor * 1000)} m`;
  }

  return `${valor.toFixed(1)} km`;
}
