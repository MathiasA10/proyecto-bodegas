import { useCallback, useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Home,
  Loader2,
  MapPin,
  Package,
  Phone,
  Store,
  Truck,
  User,
} from 'lucide-react';

import api from '../api/client';
import { getRol } from '../utils/auth';
import '../utils/fixLeafletIcon';

const LIMA_CENTRO = [-12.046374, -77.042793];

const PASOS_DELIVERY = [
  { estado: 'PENDIENTE', etiqueta: 'Pedido recibido', icono: Clock },
  { estado: 'EN_PREPARACIÓN', etiqueta: 'En preparación', icono: Package },
  { estado: 'EN_CAMINO', etiqueta: 'En camino', icono: Truck },
  { estado: 'ENTREGADO', etiqueta: 'Entregado', icono: CheckCircle2 },
];

const PASOS_RECOJO = [
  { estado: 'PENDIENTE', etiqueta: 'Pedido recibido', icono: Clock },
  { estado: 'EN_PREPARACIÓN', etiqueta: 'En preparación', icono: Package },
  { estado: 'LISTO_PARA_RECOGER', etiqueta: 'Listo para recoger', icono: Store },
  { estado: 'ENTREGADO', etiqueta: 'Entregado', icono: CheckCircle2 },
];

function obtenerPasos(pedido) {
  return pedido.metodo_entrega === 'RECOJO' ? PASOS_RECOJO : PASOS_DELIVERY;
}

function MapAnimator({ coords, zoom = 14 }) {
  const map = useMap();
  useEffect(() => {
    if (coords) map.flyTo(coords, zoom, { duration: 1.2 });
  }, [coords, map, zoom]);
  return null;
}

function formatFecha(fechaStr) {
  return new Date(fechaStr).toLocaleString('es-PE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function SeguimientoPedido() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [pedido, setPedido] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [repartidorPos, setRepartidorPos] = useState(null);
  const activoRef = useRef(true);

  const cargarPedido = useCallback(async () => {
    try {
      const res = await api.get(`cliente/pedidos/${id}/seguimiento/`);
      if (!activoRef.current) return;
      const data = res.data;
      setPedido(data);
      if (data.repartidor?.latitud != null && data.repartidor?.longitud != null) {
        setRepartidorPos([data.repartidor.latitud, data.repartidor.longitud]);
      } else {
        setRepartidorPos(null);
      }
      setError('');
    } catch (err) {
      if (!activoRef.current) return;
      setError(
        err.response?.data?.error ||
          'No pudimos cargar el seguimiento de este pedido.'
      );
    } finally {
      if (activoRef.current) setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    activoRef.current = true;
    cargarPedido();
    const intervalo = setInterval(cargarPedido, 5000);
    return () => {
      activoRef.current = false;
      clearInterval(intervalo);
    };
  }, [cargarPedido]);

  const volver = () => {
    navigate(getRol() === 'BODEGUERO' ? '/bodega/dashboard/pedidos' : '/mis-pedidos');
  };

  if (loading && !pedido) {
    return (
      <div className="flex min-h-screen flex-col bg-cream-50">
        <header className="border-b border-brand-100 bg-white px-4 py-3">
          <div className="mx-auto flex max-w-6xl items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white">
              <Store size={18} />
            </span>
            <div>
              <h1 className="text-sm font-extrabold text-slate-900">
                Seguimiento de pedido
              </h1>
              <p className="text-[11px] text-slate-500">Cargando...</p>
            </div>
          </div>
        </header>
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-brand-600" />
        </div>
      </div>
    );
  }

  if (error && !pedido) {
    return (
      <div className="flex min-h-screen flex-col bg-cream-50">
        <header className="border-b border-brand-100 bg-white px-4 py-3">
          <button
            type="button"
            onClick={volver}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 transition hover:text-brand-700"
          >
            <ArrowLeft size={16} /> Volver
          </button>
        </header>
        <div className="flex flex-1 items-center justify-center px-4">
          <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <AlertCircle size={42} className="mx-auto mb-3 text-red-500" />
            <h2 className="text-base font-bold text-slate-800">
              No pudimos mostrar el pedido
            </h2>
            <p className="mt-1 text-sm text-slate-500">{error}</p>
            <button
              type="button"
              onClick={volver}
              className="mt-5 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
            >
              Volver
            </button>
          </div>
        </div>
      </div>
    );
  }

  const esRecojo = pedido.metodo_entrega === 'RECOJO';
  const cancelado = pedido.estado === 'CANCELADO';
  const pasos = obtenerPasos(pedido);
  const indiceActual = Math.max(
    0,
    pasos.findIndex((paso) => paso.estado === pedido.estado)
  );

  const coordsBodega =
    pedido.bodega?.latitud != null && pedido.bodega?.longitud != null
      ? [pedido.bodega.latitud, pedido.bodega.longitud]
      : null;
  const coordsCliente =
    !esRecojo && pedido.cliente_lat != null && pedido.cliente_lng != null
      ? [pedido.cliente_lat, pedido.cliente_lng]
      : null;

  const centerMap = repartidorPos || coordsCliente || coordsBodega || LIMA_CENTRO;

  return (
    <div className="min-h-screen bg-cream-50">
      <header className="sticky top-0 z-20 border-b border-brand-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={volver}
              className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-brand-700"
            >
              <ArrowLeft size={18} />
            </button>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white">
              <Package size={18} />
            </span>
            <div>
              <h1 className="text-sm font-extrabold text-slate-900">
                Pedido #{pedido.pedido_id}
              </h1>
              <p className="text-[11px] text-slate-500">
                {formatFecha(pedido.created_at)}
              </p>
            </div>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
              cancelado
                ? 'bg-red-100 text-red-700'
                : pedido.estado === 'ENTREGADO'
                  ? 'bg-brand-100 text-brand-800'
                  : 'bg-accent-100 text-accent-600'
            }`}
          >
            {cancelado
              ? 'Cancelado'
              : pasos[indiceActual]?.etiqueta || pedido.estado}
          </span>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-4 px-4 py-5 lg:grid-cols-[360px_1fr]">
        <section className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400">
              Progreso del pedido
            </h2>
            {cancelado ? (
              <div className="mt-3 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">
                <AlertCircle size={16} /> Este pedido fue cancelado.
              </div>
            ) : (
              <ol className="mt-3 space-y-3">
                {pasos.map((paso, indice) => {
                  const completado = indice <= indiceActual;
                  const actual = indice === indiceActual;
                  const Icono = paso.icono;
                  return (
                    <li key={paso.estado} className="flex items-start gap-3">
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                          completado
                            ? 'bg-brand-600 text-white'
                            : 'bg-slate-100 text-slate-400'
                        } ${actual ? 'ring-4 ring-brand-100' : ''}`}
                      >
                        <Icono size={15} />
                      </span>
                      <div className="pt-1">
                        <p
                          className={`text-xs font-semibold ${
                            completado ? 'text-slate-800' : 'text-slate-400'
                          }`}
                        >
                          {paso.etiqueta}
                        </p>
                        {actual && (
                          <p className="text-[10px] text-brand-700">Estado actual</p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>

          <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400">
              Detalles
            </h2>

            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                Bodega
              </p>
              <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-slate-800">
                <Store size={13} className="text-brand-600" /> {pedido.bodega.nombre}
              </p>
              <p className="text-[11px] text-slate-500">{pedido.bodega.direccion}</p>
              {pedido.bodega.telefono && (
                <a
                  href={`tel:${pedido.bodega.telefono}`}
                  className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-brand-700"
                >
                  <Phone size={11} /> {pedido.bodega.telefono}
                </a>
              )}
            </div>

            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                {esRecojo ? 'Recojo en tienda' : 'Entrega'}
              </p>
              <p className="mt-1 flex items-start gap-1 text-[11px] text-slate-700">
                <MapPin size={13} className="mt-0.5 shrink-0 text-brand-600" />
                {pedido.direccion_entrega}
              </p>
              {!esRecojo && pedido.distancia_km != null && (
                <p className="mt-1 text-[10px] text-slate-400">
                  {Number(pedido.distancia_km).toFixed(1)} km desde la bodega
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                  Pago
                </p>
                <p className="mt-1 text-xs font-semibold text-slate-700">
                  {pedido.metodo_pago === 'CONTRA_ENTREGA'
                    ? 'Contra entrega'
                    : pedido.metodo_pago}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                  Total
                </p>
                <p className="mt-1 text-sm font-extrabold text-slate-900">
                  S/ {Number(pedido.total).toFixed(2)}
                </p>
              </div>
            </div>

            {pedido.items?.length > 0 && (
              <div className="rounded-xl border border-slate-200 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                  Productos
                </p>
                <ul className="mt-2 space-y-1">
                  {pedido.items.map((item, indice) => (
                    <li
                      key={`${item.producto}-${indice}`}
                      className="flex justify-between gap-2 text-[11px] text-slate-600"
                    >
                      <span>
                        {item.cantidad}x {item.producto}
                      </span>
                      <span className="font-semibold text-slate-700">
                        S/ {(item.cantidad * item.precio_unitario).toFixed(2)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <p className="text-center text-[10px] text-slate-400">
            Actualizando cada 5 segundos.
          </p>
        </section>

        <section className="relative min-h-[360px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <MapContainer center={centerMap} zoom={14} className="h-full min-h-[360px] w-full">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapAnimator coords={centerMap} />

            {coordsBodega && (
              <Marker position={coordsBodega}>
                <Popup>
                  <p className="text-xs font-bold text-slate-900">
                    {pedido.bodega.nombre}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {pedido.bodega.direccion}
                  </p>
                </Popup>
              </Marker>
            )}

            {coordsCliente && (
              <Marker position={coordsCliente}>
                <Popup>
                  <p className="flex items-center gap-1 text-xs font-bold text-slate-900">
                    <Home size={12} className="text-brand-600" /> Punto de entrega
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {pedido.direccion_entrega}
                  </p>
                </Popup>
              </Marker>
            )}

            {repartidorPos && (
              <Marker position={repartidorPos}>
                <Popup>
                  <p className="flex items-center gap-1 text-xs font-bold text-slate-900">
                    <Truck size={12} className="text-purple-600" /> Repartidor en camino
                  </p>
                </Popup>
              </Marker>
            )}
          </MapContainer>

          <div className="absolute bottom-3 left-3 rounded-xl bg-white/95 p-2.5 text-[10px] shadow-lg backdrop-blur">
            <p className="flex items-center gap-1.5 text-slate-600">
              <Store size={11} className="text-brand-600" /> Bodega
            </p>
            {!esRecojo && (
              <p className="mt-1 flex items-center gap-1.5 text-slate-600">
                <Home size={11} className="text-brand-600" /> Destino
              </p>
            )}
            {repartidorPos && (
              <p className="mt-1 flex items-center gap-1.5 text-slate-600">
                <Truck size={11} className="text-purple-600" /> Repartidor
              </p>
            )}
          </div>

          {esRecojo && (
            <div className="absolute right-3 top-3 max-w-[220px] rounded-xl border border-brand-200 bg-white/95 p-3 text-[11px] text-slate-600 shadow-lg backdrop-blur">
              <p className="flex items-center gap-1 font-bold text-brand-800">
                <User size={12} /> Recojo en tienda
              </p>
              <p className="mt-1">
                {pedido.estado === 'LISTO_PARA_RECOGER'
                  ? `Tu pedido está listo. Acércate a ${pedido.bodega.direccion}.`
                  : `Acércate a ${pedido.bodega.direccion} cuando tu pedido esté listo.`}
              </p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
