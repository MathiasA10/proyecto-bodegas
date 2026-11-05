import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Circle,
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
} from 'react-leaflet';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  ClipboardList,
  Clock,
  LogIn,
  LogOut,
  MapPin,
  Navigation,
  Phone,
  Search,
  ShoppingBag,
  Store,
} from 'lucide-react';

import api from '../api/client';
import { useCart } from '../hooks/useCart';
import { useGeolocation } from '../hooks/useGeolocation';
import { cerrarSesion, estaAutenticado, getRol } from '../utils/auth';
import { LIMA_CENTRO, formatearDistancia } from '../utils/geo';
import '../utils/fixLeafletIcon';

function CambiarCentroMapa({ coords }) {
  const map = useMap();

  useEffect(() => {
    if (coords) {
      map.flyTo(coords, 16, { duration: 1.2 });
    }
  }, [coords, map]);

  return null;
}

export default function MapaCliente() {
  const [bodegas, setBodegas] = useState([]);
  const [bodegaActiva, setBodegaActiva] = useState(null);
  const [filtro, setFiltro] = useState('');
  const [cargando, setCargando] = useState(true);
  const [centroMapa, setCentroMapa] = useState(LIMA_CENTRO);
  const navigate = useNavigate();
  const { bodega: carritoBodega, cantidadTotal, total } = useCart();

  const { coords, error: geoError, loading: geoLoading, solicitar } =
    useGeolocation();

  const [lat, lng] = coords || LIMA_CENTRO;

  const cargarBodegas = useCallback(async (latitud, longitud) => {
    setCargando(true);
    try {
      const res = await api.get('public/bodegas/', {
        params: { lat: latitud, lng: longitud },
      });
      setBodegas(res.data);
    } catch (err) {
      console.error('Error al obtener bodegas:', err);
      setBodegas([]);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    solicitar();
  }, [solicitar]);

  useEffect(() => {
    cargarBodegas(lat, lng);
  }, [lat, lng, cargarBodegas]);

  useEffect(() => {
    if (coords) setCentroMapa(coords);
  }, [coords]);

  const bodegasFiltradas = useMemo(() => {
    const q = filtro.toLowerCase().trim();
    if (!q) return bodegas;

    return bodegas.filter(
      (b) =>
        b.nombre_comercial.toLowerCase().includes(q) ||
        b.direccion.toLowerCase().includes(q)
    );
  }, [bodegas, filtro]);

  const seleccionarBodega = (bodega) => {
    setBodegaActiva(bodega);
    setCentroMapa([Number(bodega.latitud), Number(bodega.longitud)]);
  };

  const abrirTienda = (bodega) => {
    navigate(`/tienda/${bodega.id}`);
  };

  const salir = () => {
    cerrarSesion();
    navigate('/');
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-cream-50 font-sans">
      <header className="z-10 flex items-center justify-between gap-3 border-b border-brand-100 bg-white px-4 py-3 shadow-sm sm:px-6">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-brand-700"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white">
            <Store size={20} />
          </span>
          <span className="hidden text-left leading-tight sm:block">
            <span className="block text-base font-extrabold text-slate-900">
              Bodegas Cercanas
            </span>
            <span className="text-[11px] font-normal text-slate-500">
              Lima Metropolitana
            </span>
          </span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={solicitar}
            disabled={geoLoading}
            className="flex items-center gap-1.5 rounded-xl bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-700 transition hover:bg-brand-100 disabled:opacity-60"
          >
            <Navigation size={14} />
            {geoLoading ? 'Ubicando...' : 'Mi ubicación'}
          </button>
          {estaAutenticado() ? (
            <>
              {getRol() === 'CLIENTE' ? (
                <button
                  onClick={() => navigate('/mis-pedidos')}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
                >
                  <ClipboardList size={14} />
                  <span className="hidden sm:inline">Mis pedidos</span>
                </button>
              ) : (
                <button
                  onClick={() => navigate('/bodega/dashboard')}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
                >
                  <Store size={14} />
                  <span className="hidden sm:inline">Mi panel</span>
                </button>
              )}
              <button
                onClick={salir}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
              >
                <LogOut size={14} />
                <span className="hidden sm:inline">Cerrar sesión</span>
              </button>
            </>
          ) : (
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
            >
              <LogIn size={14} />
              <span className="hidden sm:inline">Iniciar sesión</span>
            </button>
          )}
        </div>
      </header>

      {geoError && (
        <div className="border-b border-accent-200 bg-accent-50 px-4 py-2 text-center text-[11px] font-medium text-accent-600">
          {geoError}
        </div>
      )}

      <div className="flex flex-1 flex-col overflow-hidden lg:flex-row">
        <aside className="z-10 flex h-[45%] w-full flex-col border-b border-slate-200 bg-white shadow-sm lg:h-full lg:w-[380px] lg:border-b-0 lg:border-r">
          <div className="border-b border-slate-100 p-4">
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                size={16}
              />
              <input
                type="text"
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
                placeholder="Buscar bodega o dirección..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-xs outline-none transition focus:border-brand-500 focus:bg-white"
              />
            </div>
            <div className="mt-2 flex items-center justify-between px-1 text-[11px] font-medium text-slate-500">
              <span>
                {cargando
                  ? 'Buscando bodegas...'
                  : `${bodegasFiltradas.length} bodegas cerca`}
              </span>
              <span className="text-brand-600">Ordenado por cercanía</span>
            </div>
          </div>

          <div className="flex-1 divide-y divide-slate-100 overflow-y-auto">
            {!cargando && bodegasFiltradas.length === 0 && (
              <div className="px-6 py-12 text-center text-xs text-slate-400">
                No encontramos bodegas dentro del radio de entrega.
              </div>
            )}

            {bodegasFiltradas.map((b) => {
              const activa = bodegaActiva?.id === b.id;
              return (
                <button
                  key={b.id}
                  onClick={() => seleccionarBodega(b)}
                  className={`flex w-full flex-col gap-1.5 p-4 text-left transition ${
                    activa
                      ? 'border-l-4 border-brand-600 bg-brand-50/70'
                      : 'hover:bg-cream-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-bold text-slate-800">
                      {b.nombre_comercial}
                    </h3>
                    <span className="shrink-0 rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-bold text-brand-800">
                      {formatearDistancia(b.distancia_km)}
                    </span>
                  </div>

                  <p className="flex items-center gap-1 text-[11px] text-slate-500">
                    <MapPin size={12} className="shrink-0 text-slate-400" />
                    <span className="truncate">{b.direccion}</span>
                  </p>

                  <div className="flex items-center justify-between pt-1 text-[11px]">
                    <span className="flex items-center gap-1 text-slate-500">
                      <Phone size={11} className="text-slate-400" />
                      {b.telefono || 'Sin número'}
                    </span>
                    <span className="flex items-center gap-1 font-semibold text-brand-700">
                      <ShoppingBag size={11} />
                      {b.productos_count} productos
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-[10px] font-medium text-slate-500">
                    <span className="flex items-center gap-1 text-brand-700">
                      <CheckCircle2 size={11} /> Abierta
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock size={11} /> Radio {Number(b.radio_entrega_km)} km
                    </span>
                  </div>

                  <span className="mt-1 inline-flex w-fit items-center gap-1 rounded-lg bg-brand-600 px-3 py-1.5 text-[11px] font-semibold text-white">
                    Ver tienda
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        <div className="relative flex-1">
          <MapContainer
            center={LIMA_CENTRO}
            zoom={13}
            className="h-full w-full"
            scrollWheelZoom
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <CambiarCentroMapa coords={centroMapa} />

            {bodegaActiva && (
              <Circle
                center={[
                  Number(bodegaActiva.latitud),
                  Number(bodegaActiva.longitud),
                ]}
                radius={Number(bodegaActiva.radio_entrega_km) * 1000}
                pathOptions={{
                  color: '#059669',
                  fillColor: '#10b981',
                  fillOpacity: 0.08,
                  weight: 2,
                  dashArray: '6 6',
                }}
              />
            )}

            {bodegasFiltradas.map((b) => (
              <Marker
                key={b.id}
                position={[Number(b.latitud), Number(b.longitud)]}
                eventHandlers={{ click: () => seleccionarBodega(b) }}
              >
                <Popup>
                  <div className="min-w-[210px] p-1">
                    <h3 className="text-sm font-bold text-slate-900">
                      {b.nombre_comercial}
                    </h3>
                    <p className="text-[11px] text-slate-500">{b.direccion}</p>
                    <p className="mt-0.5 text-[10px] font-semibold text-brand-700">
                      A {formatearDistancia(b.distancia_km)} de ti · Radio{' '}
                      {Number(b.radio_entrega_km)} km
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      {b.productos_count} productos disponibles
                    </p>
                    <button
                      onClick={() => abrirTienda(b)}
                      className="mt-3 w-full rounded-lg bg-brand-600 px-3 py-2 text-[11px] font-semibold text-white transition hover:bg-brand-700"
                    >
                      Entrar a la tienda
                    </button>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>

          {cantidadTotal > 0 && carritoBodega && (
            <div className="absolute bottom-4 left-1/2 z-[500] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-2xl border border-brand-100 bg-white p-3 shadow-xl">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white">
                    <ShoppingBag size={18} />
                  </span>
                  <div className="leading-tight">
                    <p className="text-xs font-bold text-slate-800">
                      {cantidadTotal} producto{cantidadTotal === 1 ? '' : 's'} · S/{' '}
                      {total.toFixed(2)}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {carritoBodega.nombre}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => navigate(`/tienda/${carritoBodega.id}`)}
                  className="rounded-xl bg-accent-400 px-4 py-2 text-xs font-bold text-slate-900 transition hover:bg-accent-500"
                >
                  Ver carrito
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
