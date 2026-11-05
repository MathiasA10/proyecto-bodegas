import { useCallback, useState } from 'react';

import { LIMA_CENTRO } from '../utils/geo';

export function useGeolocation() {
  const [coords, setCoords] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const solicitar = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setError('Tu navegador no soporta geolocalización.');
      return;
    }

    setLoading(true);

    navigator.geolocation.getCurrentPosition(
      (posicion) => {
        setCoords([posicion.coords.latitude, posicion.coords.longitude]);
        setError('');
        setLoading(false);
      },
      () => {
        setCoords(null);
        setError(
          'No pudimos obtener tu ubicación. Usamos Lima Centro como referencia.'
        );
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  }, []);

  return { coords, error, loading, solicitar, LIMA_CENTRO };
}

export default useGeolocation;
