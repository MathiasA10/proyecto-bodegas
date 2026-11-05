import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import {
  Loader2,
  MapPin as MapPinIcon,
  MoreVertical,
  Package,
  Phone,
  RefreshCw,
  ShoppingBag,
  Truck,
} from 'lucide-react';

import api from '../api/client';
import Toast from '../components/Toast';
import '../utils/fixLeafletIcon';

const ESTADOS = [
  { value: 'PENDIENTE', label: 'Pendiente', color: 'bg-accent-100 text-accent-600' },
  { value: 'EN_PREPARACIÓN', label: 'En preparación', color: 'bg-blue-100 text-blue-700' },
  { value: 'EN_CAMINO', label: 'En camino', color: 'bg-purple-100 text-purple-700' },
  { value: 'LISTO_PARA_RECOGER', label: 'Listo para recoger', color: 'bg-brand-100 text-brand-800' },
  { value: 'ENTREGADO', label: 'Entregado', color: 'bg-brand-100 text-brand-800' },
  { value: 'CANCELADO', label: 'Cancelado', color: 'bg-red-100 text-red-700' },
];

const TRANSICIONES_DELIVERY = {
  PENDIENTE: ['EN_PREPARACIÓN', 'CANCELADO'],
  EN_PREPARACIÓN: ['EN_CAMINO', 'CANCELADO'],
  EN_CAMINO: ['ENTREGADO', 'CANCELADO'],
  ENTREGADO: [],
  CANCELADO: [],
};

const TRANSICIONES_RECOJO = {
  PENDIENTE: ['EN_PREPARACIÓN', 'CANCELADO'],
  EN_PREPARACIÓN: ['LISTO_PARA_RECOGER', 'CANCELADO'],
  LISTO_PARA_RECOGER: ['ENTREGADO', 'CANCELADO'],
  ENTREGADO: [],
  CANCELADO: [],
};

function obtenerTransiciones(pedido) {
  const mapa =
    pedido.metodo_entrega === 'RECOJO'
      ? TRANSICIONES_RECOJO
      : TRANSICIONES_DELIVERY;
  return mapa[pedido.estado] || [];
}

function MapaRepartidor({ posicion, onSelect }) {
  useMapEvents({
    click(e) {
      onSelect({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return <Marker position={[posicion.lat, posicion.lng]} />;
}

function MenuAcciones({ pedido, transiciones, puedeVerRepartidor, onCambiarEstado, onAbrirMapa }) {
  const [abierto, setAbierto] = useState(false);
  const [posicion, setPosicion] = useState({ top: 0, left: 0 });
  const botonRef = useRef(null);
  const menuRef = useRef(null);

  const abrir = () => {
    const rect = botonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const ancho = 190;
    setPosicion({
      top: rect.bottom + 4,
      left: Math.max(8, Math.min(rect.right - ancho, window.innerWidth - ancho - 8)),
    });
    setAbierto(true);
  };

  useEffect(() => {
    if (!abierto) return undefined;

    const cerrar = (evento) => {
      const dentroBoton = botonRef.current?.contains(evento.target);
      const dentroMenu = menuRef.current?.contains(evento.target);
      if (!dentroBoton && !dentroMenu) setAbierto(false);
    };
    const cerrarPorScroll = () => setAbierto(false);
    const cerrarPorTecla = (evento) => {
      if (evento.key === 'Escape') setAbierto(false);
    };

    document.addEventListener('mousedown', cerrar);
    window.addEventListener('scroll', cerrarPorScroll, true);
    window.addEventListener('resize', cerrarPorScroll);
    document.addEventListener('keydown', cerrarPorTecla);
    return () => {
      document.removeEventListener('mousedown', cerrar);
      window.removeEventListener('scroll', cerrarPorScroll, true);
      window.removeEventListener('resize', cerrarPorScroll);
      document.removeEventListener('keydown', cerrarPorTecla);
    };
  }, [abierto]);

  const ejecutar = (accion) => {
    setAbierto(false);
    accion();
  };

  return (
    <>
      <button
        ref={botonRef}
        type="button"
        onClick={() => (abierto ? setAbierto(false) : abrir())}
        className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
        aria-label="Acciones del pedido"
        aria-expanded={abierto}
      >
        <MoreVertical size={18} />
      </button>

      {abierto &&
        createPortal(
          <div
            ref={menuRef}
            style={{ position: 'fixed', top: posicion.top, left: posicion.left, width: 190 }}
            className="z-[1000] overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl"
          >
            {transiciones.map((estado) => (
              <button
                key={estado}
                type="button"
                onClick={() => ejecutar(() => onCambiarEstado(pedido.id, estado))}
                className="w-full px-3 py-2 text-left text-xs font-medium text-slate-700 transition hover:bg-slate-50"
              >
                {ESTADOS.find((e) => e.value === estado)?.label}
              </button>
            ))}
            {puedeVerRepartidor && (
              <button
                type="button"
                onClick={() => ejecutar(() => onAbrirMapa(pedido))}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-purple-600 transition hover:bg-purple-50"
              >
                <MapPinIcon size={14} /> Ubicar repartidor
              </button>
            )}
          </div>,
          document.body
        )}
    </>
  );
}

export default function BodegaPedidos() {
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mensaje, setMensaje] = useState({ tipo: '', texto: '' });
  const [modalRepartidor, setModalRepartidor] = useState(null);
  const [repartidorPos, setRepartidorPos] = useState({ lat: -12.046374, lng: -77.042793 });
  const [guardandoRepartidor, setGuardandoRepartidor] = useState(false);

  const cargarPedidos = async () => {
    setLoading(true);
    try {
      const res = await api.get('bodega/pedidos/');
      setPedidos(res.data);
    } catch {
      setMensaje({ tipo: 'error', texto: 'Error al cargar los pedidos.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarPedidos();
  }, []);

  const handleCambiarEstado = async (pedidoId, nuevoEstado) => {
    try {
      await api.patch(`bodega/pedidos/${pedidoId}/estado/`, { estado: nuevoEstado });
      const etiqueta = getEstadoInfo(nuevoEstado).label;
      setMensaje({ tipo: 'success', texto: `Estado actualizado a "${etiqueta}".` });
      cargarPedidos();
    } catch (err) {
      setMensaje({
        tipo: 'error',
        texto: err.response?.data?.error || 'Error al cambiar estado.',
      });
    }
  };

  const abrirModalRepartidor = (pedido) => {
    setModalRepartidor(pedido);
    setRepartidorPos({ lat: -12.046374, lng: -77.042793 });
  };

  const guardarRepartidor = async () => {
    if (!modalRepartidor) return;
    setGuardandoRepartidor(true);
    try {
      await api.patch(`bodega/pedidos/${modalRepartidor.id}/repartidor/`, {
        repartidor_lat: repartidorPos.lat,
        repartidor_lng: repartidorPos.lng
      });
      setMensaje({ tipo: 'success', texto: 'Ubicación del repartidor actualizada.' });
      setModalRepartidor(null);
      cargarPedidos();
    } catch (err) {
      setMensaje({
        tipo: 'error',
        texto: err.response?.data?.error || 'Error al guardar ubicación.',
      });
    } finally {
      setGuardandoRepartidor(false);
    }
  };

  const getEstadoInfo = (estado) =>
    ESTADOS.find((e) => e.value === estado) || {
      label: estado,
      color: 'bg-slate-100 text-slate-600',
    };

  const formatFecha = (fechaStr) => {
    const fecha = new Date(fechaStr);
    return fecha.toLocaleString('es-PE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-4">
      <Toast
        tipo={mensaje.tipo || 'success'}
        texto={mensaje.texto}
        onClose={() => setMensaje({ tipo: '', texto: '' })}
      />

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-extrabold text-slate-900">Pedidos de la Bodega</h2>
        <button
          type="button"
          onClick={cargarPedidos}
          disabled={loading}
          className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Actualizar
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
        </div>
      ) : pedidos.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
          <ShoppingBag size={48} className="mx-auto mb-3 text-slate-300" />
          <p className="text-sm text-slate-500">No hay pedidos registrados aún.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pedidos.map((pedido) => {
            const estadoInfo = getEstadoInfo(pedido.estado);
            const transiciones = obtenerTransiciones(pedido);
            const esEstadoFinal = pedido.estado === 'ENTREGADO' || pedido.estado === 'CANCELADO';
            const puedeVerRepartidor =
              pedido.metodo_entrega === 'DELIVERY' &&
              (pedido.estado === 'EN_CAMINO' || pedido.estado === 'ENTREGADO');

            return (
              <article
                key={pedido.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 font-mono text-xs font-bold text-brand-700">
                      #{pedido.id}
                    </span>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">{pedido.nombre_cliente}</h3>
                      <p className="flex items-center gap-1 text-[11px] text-slate-500">
                        <Phone size={11} /> {pedido.telefono_cliente}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${estadoInfo.color}`}>
                      {estadoInfo.label}
                    </span>
                    {!esEstadoFinal ? (
                      <MenuAcciones
                        pedido={pedido}
                        transiciones={transiciones}
                        puedeVerRepartidor={puedeVerRepartidor}
                        onCambiarEstado={handleCambiarEstado}
                        onAbrirMapa={abrirModalRepartidor}
                      />
                    ) : (
                      <span className="text-[11px] font-medium text-slate-400">Finalizado</span>
                    )}
                  </div>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-xl bg-slate-50 p-2.5">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                      Dirección
                    </p>
                    <p className="mt-0.5 text-xs text-slate-700">{pedido.direccion_entrega}</p>
                    <p className="mt-0.5 text-[10px] text-slate-400">
                      {pedido.metodo_entrega === 'RECOJO' ? 'Recojo en tienda' : 'Delivery'}
                      {pedido.distancia_km != null
                        ? ` · ${Number(pedido.distancia_km).toFixed(1)} km`
                        : ''}
                    </p>
                  </div>

                  <div className="rounded-xl bg-slate-50 p-2.5">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                      Total
                    </p>
                    <p className="mt-0.5 text-sm font-extrabold text-slate-900">
                      S/ {parseFloat(pedido.total).toFixed(2)}
                    </p>
                  </div>

                  <div className="rounded-xl bg-slate-50 p-2.5">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                      Fecha
                    </p>
                    <p className="mt-0.5 text-xs text-slate-700">{formatFecha(pedido.created_at)}</p>
                  </div>

                  <div className="rounded-xl bg-slate-50 p-2.5">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                      Pago
                    </p>
                    <p className="mt-0.5 text-xs text-slate-700">{pedido.metodo_pago}</p>
                  </div>
                </div>

                {pedido.items?.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {pedido.items.map((item, indice) => (
                      <span
                        key={`${pedido.id}-${indice}`}
                        className="flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-600"
                      >
                        <Package size={10} /> {item.cantidad}x {item.producto}
                      </span>
                    ))}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {modalRepartidor && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/50 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 p-4">
              <h3 className="font-bold text-slate-900">
                Ubicar Repartidor - Pedido #{modalRepartidor.id}
              </h3>
              <button
                type="button"
                onClick={() => setModalRepartidor(null)}
                className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                aria-label="Cerrar"
              >
                ×
              </button>
            </div>
            <div className="p-4">
              <p className="mb-3 flex items-center gap-1 text-sm text-slate-600">
                <Truck size={15} /> Haz clic en el mapa para marcar la posición actual del repartidor.
              </p>
              <div className="h-64 w-full overflow-hidden rounded-xl border border-slate-200">
                <MapContainer center={[repartidorPos.lat, repartidorPos.lng]} zoom={15} className="h-full w-full">
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <MapaRepartidor posicion={repartidorPos} onSelect={setRepartidorPos} />
                </MapContainer>
              </div>
              <div className="mt-3 text-xs text-slate-500">
                Lat: {repartidorPos.lat.toFixed(6)}, Lng: {repartidorPos.lng.toFixed(6)}
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 p-4">
              <button
                type="button"
                onClick={() => setModalRepartidor(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={guardarRepartidor}
                disabled={guardandoRepartidor}
                className="flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
              >
                {guardandoRepartidor && <Loader2 size={14} className="animate-spin" />}
                Guardar ubicación
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
