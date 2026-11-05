import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Circle,
  MapContainer,
  Marker,
  TileLayer,
  useMapEvents,
} from 'react-leaflet';
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Home,
  LogIn,
  MapPin,
  Minus,
  Phone,
  Plus,
  QrCode,
  ShoppingBag,
  Store,
  Trash2,
  Truck,
} from 'lucide-react';

import api from '../api/client';
import CatalogoProductos from '../components/CatalogoProductos';
import { useCart } from '../hooks/useCart';
import { useGeolocation } from '../hooks/useGeolocation';
import { estaAutenticado, getNombre, getRol } from '../utils/auth';
import { calcularDistanciaKm, formatearDistancia } from '../utils/geo';
import { esTelefonoValido, normalizarTelefono } from '../utils/validators';
import '../utils/fixLeafletIcon';

const PASOS = ['Carrito', 'Entrega', 'Pago', 'Confirmar'];

function SelectorPunto({ tienda, posicion, onSelect }) {
  useMapEvents({
    click(evento) {
      onSelect([evento.latlng.lat, evento.latlng.lng]);
    },
  });

  const centroTienda = [Number(tienda.latitud), Number(tienda.longitud)];

  return (
    <>
      <Circle
        center={centroTienda}
        radius={Number(tienda.radio_entrega_km) * 1000}
        pathOptions={{
          color: '#059669',
          fillColor: '#10b981',
          fillOpacity: 0.08,
          weight: 2,
          dashArray: '6 6',
        }}
      />
      <Marker position={centroTienda} />
      {posicion && <Marker position={posicion} />}
    </>
  );
}

function MapaEntrega({ tienda, posicion, onSelect }) {
  return (
    <div className="h-52 overflow-hidden rounded-xl border border-slate-200">
      <MapContainer
        center={[Number(tienda.latitud), Number(tienda.longitud)]}
        zoom={15}
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <SelectorPunto
          tienda={tienda}
          posicion={posicion}
          onSelect={onSelect}
        />
      </MapContainer>
    </div>
  );
}

function formatoPrecio(valor) {
  return Number(valor || 0).toFixed(2);
}

export default function TiendaPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const cart = useCart();

  const [tienda, setTienda] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState('');
  const [errorPedido, setErrorPedido] = useState('');
  const [paso, setPaso] = useState(1);
  const [metodoEntrega, setMetodoEntrega] = useState('RECOJO');
  const [metodoPago, setMetodoPago] = useState('CONTRA_ENTREGA');
  const [cliente, setCliente] = useState({
    nombre: getNombre(),
    telefono: '',
    direccion: '',
    referencia: '',
  });
  const [ubicacionEntrega, setUbicacionEntrega] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [pedidoCreado, setPedidoCreado] = useState(null);

  const { coords, error: geoError, loading: geoLoading, solicitar } =
    useGeolocation();

  useEffect(() => {
    let activo = true;

    async function cargarTienda() {
      setCargando(true);
      setErrorCarga('');

      try {
        const res = await api.get(`public/bodegas/${id}/`);
        if (activo) setTienda(res.data);
      } catch (err) {
        if (activo) {
          setErrorCarga(
            err.response?.data?.detail || 'No encontramos esta bodega.'
          );
        }
      } finally {
        if (activo) setCargando(false);
      }
    }

    cargarTienda();

    return () => {
      activo = false;
    };
  }, [id]);

  useEffect(() => {
    if (coords) {
      setUbicacionEntrega((actual) => actual || coords);
    }
  }, [coords]);

  useEffect(() => {
    setPaso(1);
    setPedidoCreado(null);
    setErrorPedido('');
  }, [id]);

  const carritoDeTienda = tienda ? cart.esDeTienda(tienda.id) : false;
  const itemsCarrito = carritoDeTienda ? cart.items : [];
  const cantidadCarrito = carritoDeTienda ? cart.cantidadTotal : 0;
  const totalCarrito = carritoDeTienda ? cart.total : 0;

  const distanciaTienda =
    coords && tienda
      ? calcularDistanciaKm(
          coords[0],
          coords[1],
          Number(tienda.latitud),
          Number(tienda.longitud)
        )
      : null;

  const distanciaEntrega =
    ubicacionEntrega && tienda
      ? calcularDistanciaKm(
          ubicacionEntrega[0],
          ubicacionEntrega[1],
          Number(tienda.latitud),
          Number(tienda.longitud)
        )
      : null;

  const dentroRadio =
    distanciaEntrega !== null &&
    tienda &&
    distanciaEntrega <= Number(tienda.radio_entrega_km);

  const paso2Valido =
    metodoEntrega === 'RECOJO' ||
    (cliente.direccion.trim() !== '' &&
      ubicacionEntrega !== null &&
      Boolean(dentroRadio));

  const paso4Valido =
    cliente.nombre.trim() !== '' && esTelefonoValido(cliente.telefono);
  const puedeConfirmar = estaAutenticado() && getRol() === 'CLIENTE';

  const agregarProducto = (producto) => {
    if (!tienda?.abierto) return;
    cart.agregar(tienda, producto);
  };

  const continuar = () => {
    if (paso === 1 && itemsCarrito.length === 0) return;
    if (paso === 2 && !paso2Valido) return;
    if (paso < 4) setPaso((actual) => actual + 1);
  };

  const retroceder = () => {
    if (paso > 1) setPaso((actual) => actual - 1);
  };

  const confirmarPedido = async () => {
    if (!tienda || itemsCarrito.length === 0 || !paso4Valido) return;
    if (!puedeConfirmar) {
      setErrorPedido(
        'Debes iniciar sesión con una cuenta de cliente para confirmar tu pedido.'
      );
      return;
    }

    setEnviando(true);
    setErrorPedido('');

    try {
      const direccionFinal =
        metodoEntrega === 'RECOJO'
          ? tienda.direccion
          : `${cliente.direccion.trim()}${
              cliente.referencia.trim() ? ` - ${cliente.referencia.trim()}` : ''
            }`;

      const payload = {
        bodega_id: tienda.id,
        nombre_cliente: cliente.nombre.trim(),
        telefono_cliente: normalizarTelefono(cliente.telefono),
        direccion_entrega: direccionFinal,
        metodo_entrega: metodoEntrega,
        metodo_pago: metodoPago,
        cliente_lat:
          metodoEntrega === 'DELIVERY' ? ubicacionEntrega?.[0] ?? null : null,
        cliente_lng:
          metodoEntrega === 'DELIVERY' ? ubicacionEntrega?.[1] ?? null : null,
        items: itemsCarrito.map((item) => ({
          id: item.id,
          cantidad: item.cantidad,
        })),
      };

      const res = await api.post('public/pedidos/crear/', payload);

      setPedidoCreado({
        id: res.data.pedido_id,
        total: res.data.total,
        distancia: res.data.distancia_km,
      });
      cart.vaciar();
      setPaso(1);
      setCliente({
        nombre: getNombre(),
        telefono: '',
        direccion: '',
        referencia: '',
      });
    } catch (err) {
      setErrorPedido(
        err.response?.data?.error ||
          'No pudimos registrar tu pedido. Intenta nuevamente.'
      );
    } finally {
      setEnviando(false);
    }
  };

  if (cargando) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream-50">
        <div className="text-center">
          <Store className="mx-auto mb-3 text-brand-500" size={36} />
          <p className="text-sm font-medium text-slate-500">
            Cargando tienda...
          </p>
        </div>
      </div>
    );
  }

  if (errorCarga || !tienda) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream-50 px-4">
        <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <MapPin className="mx-auto mb-3 text-slate-300" size={40} />
          <h1 className="text-lg font-bold text-slate-800">
            No pudimos abrir la tienda
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {errorCarga || 'La bodega no existe o no está disponible.'}
          </p>
          <button
            onClick={() => navigate('/mapa')}
            className="mt-5 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
          >
            Volver al mapa
          </button>
        </div>
      </div>
    );
  }

  if (pedidoCreado) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream-50 px-4 py-10">
        <div className="w-full max-w-lg rounded-3xl border border-brand-100 bg-white p-8 text-center shadow-lg">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-100 text-brand-700">
            <Check size={32} />
          </span>
          <h1 className="mt-4 text-2xl font-extrabold text-slate-900">
            Pedido enviado
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Tu pedido #{pedidoCreado.id} fue registrado en {tienda.nombre_comercial}.
          </p>

          <div className="mt-5 space-y-2 rounded-2xl bg-cream-100 p-4 text-left text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Total</span>
              <span className="font-bold text-slate-900">
                S/ {formatoPrecio(pedidoCreado.total)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Entrega</span>
              <span className="font-semibold text-slate-800">
                {metodoEntrega === 'RECOJO' ? 'Recojo en tienda' : 'Delivery'}
              </span>
            </div>
            {pedidoCreado.distancia != null && (
              <div className="flex justify-between">
                <span className="text-slate-500">Distancia</span>
                <span className="font-semibold text-slate-800">
                  {formatearDistancia(pedidoCreado.distancia)}
                </span>
              </div>
            )}
          </div>

          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <button
              onClick={() =>
                navigate(`/pedido/${pedidoCreado.id}/seguimiento`)
              }
              className="flex-1 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
            >
              Seguir mi pedido
            </button>
            <button
              onClick={() => navigate('/mapa')}
              className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Volver al mapa
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream-50 pb-10 font-sans">
      <header className="sticky top-0 z-20 border-b border-brand-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
          <button
            onClick={() => navigate('/mapa')}
            className="flex items-center gap-1.5 rounded-xl px-2 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-brand-700"
          >
            <ArrowLeft size={16} />
            <span className="hidden sm:inline">Volver al mapa</span>
          </button>

          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white">
              <Store size={18} />
            </span>
            <div className="text-right sm:text-left">
              <p className="text-sm font-extrabold leading-tight text-slate-900">
                {tienda.nombre_comercial}
              </p>
              <p className="text-[11px] text-slate-500">
                {distanciaTienda === null
                  ? 'Comparte tu ubicación'
                  : `${formatearDistancia(distanciaTienda)} de ti`}
              </p>
            </div>
          </div>

          <a
            href={`tel:${tienda.telefono || ''}`}
            className="flex items-center gap-1.5 rounded-xl bg-accent-50 px-3 py-2 text-xs font-semibold text-accent-600 transition hover:bg-accent-100"
          >
            <Phone size={14} />
            <span className="hidden sm:inline">{tienda.telefono || 'Llamar'}</span>
          </a>
        </div>
      </header>

      <main className="mx-auto mt-5 grid max-w-7xl gap-6 px-4 lg:grid-cols-[1fr_390px]">
        <section>
          <div className="overflow-hidden rounded-3xl border border-brand-100 bg-gradient-to-r from-brand-600 to-brand-700 p-6 text-white shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold">
                  <Store size={12} /> Bodega de barrio
                </span>
                <h1 className="mt-2 text-2xl font-extrabold sm:text-3xl">
                  {tienda.nombre_comercial}
                </h1>
                <p className="mt-1 flex items-center gap-1 text-sm text-brand-50">
                  <MapPin size={14} /> {tienda.direccion}
                </p>
              </div>

              <div className="rounded-2xl bg-white/10 px-4 py-3 text-xs backdrop-blur">
                <p className="flex items-center gap-1 font-semibold text-white">
                  <Truck size={14} /> Radio de entrega
                </p>
                <p className="mt-1 text-2xl font-extrabold text-accent-300">
                  {Number(tienda.radio_entrega_km)} km
                </p>
                <p className="mt-0.5 text-[10px] text-brand-50">
                  Recojo y delivery dentro del radio
                </p>
              </div>
            </div>
          </div>

          {!tienda.abierto && (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              Esta bodega está cerrada en este momento. Puedes revisar el
              catálogo, pero no recibir pedidos.
            </div>
          )}

          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <CatalogoProductos
              productos={tienda.productos || []}
              categorias={tienda.categorias || []}
              abierto={Boolean(tienda.abierto)}
              onAgregar={agregarProducto}
              textoVacio="No hay productos que coincidan con tu búsqueda."
            />
          </div>
        </section>

        <aside className="lg:sticky lg:top-20 lg:h-[calc(100vh-6rem)]">
          <div className="flex h-full max-h-[calc(100vh-6rem)] flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 bg-cream-100 px-4 py-3">
              <div className="flex items-center justify-between">
                {PASOS.map((etiqueta, indice) => {
                  const numero = indice + 1;
                  const completado = paso > numero;
                  const activo = paso === numero;

                  return (
                    <div key={etiqueta} className="flex flex-1 items-center">
                      <div className="flex flex-col items-center gap-1">
                        <span
                          className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold transition ${
                            completado
                              ? 'bg-brand-600 text-white'
                              : activo
                                ? 'bg-brand-600 text-white ring-2 ring-brand-200'
                                : 'bg-slate-200 text-slate-500'
                          }`}
                        >
                          {completado ? <Check size={13} /> : numero}
                        </span>
                        <span
                          className={`text-[9px] font-semibold ${
                            paso >= numero ? 'text-slate-700' : 'text-slate-400'
                          }`}
                        >
                          {etiqueta}
                        </span>
                      </div>
                      {indice < PASOS.length - 1 && (
                        <div
                          className={`mx-1 mb-4 h-0.5 flex-1 ${
                            paso > numero ? 'bg-brand-500' : 'bg-slate-200'
                          }`}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {cart.bodega && !carritoDeTienda && cart.cantidadTotal > 0 && (
                <div className="mb-4 rounded-xl border border-accent-200 bg-accent-50 p-3 text-[11px] text-accent-600">
                  <p className="font-semibold">
                    Tu carrito tiene productos de {cart.bodega.nombre}.
                  </p>
                  <button
                    onClick={cart.vaciar}
                    className="mt-2 rounded-lg bg-white px-2.5 py-1.5 font-semibold text-accent-600 shadow-sm"
                  >
                    Vaciar y comprar aquí
                  </button>
                </div>
              )}

              {paso === 1 && (
                <div>
                  {itemsCarrito.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-14 text-center text-slate-400">
                      <ShoppingBag size={36} className="mb-2 text-slate-200" />
                      <p className="text-xs font-medium">
                        Tu carrito está vacío.
                      </p>
                      <p className="mt-1 text-[11px]">
                        Agrega productos del catálogo para comenzar.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {itemsCarrito.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 bg-white p-2.5 shadow-sm"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-semibold text-slate-800">
                              {item.nombre}
                            </p>
                            <p className="text-[10px] text-slate-500">
                              S/ {formatoPrecio(item.precio)} c/u ·{' '}
                              {item.cantidad} un.
                            </p>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <div className="flex items-center rounded-lg border border-slate-200">
                              <button
                                onClick={() =>
                                  cart.modificarCantidad(item.id, -1)
                                }
                                className="rounded-l-lg p-1.5 text-slate-500 hover:bg-slate-100"
                                aria-label="Quitar una unidad"
                              >
                                <Minus size={12} />
                              </button>
                              <span className="px-1.5 text-xs font-bold text-slate-700">
                                {item.cantidad}
                              </span>
                              <button
                                onClick={() =>
                                  cart.modificarCantidad(item.id, 1)
                                }
                                disabled={item.cantidad >= item.stock}
                                className="rounded-r-lg p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-40"
                                aria-label="Agregar una unidad"
                              >
                                <Plus size={12} />
                              </button>
                            </div>
                            <button
                              onClick={() => cart.eliminar(item.id)}
                              className="p-1 text-slate-300 transition hover:text-red-500"
                              aria-label="Eliminar producto"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}

                      <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                        <span className="text-xs font-semibold text-slate-600">
                          Total
                        </span>
                        <span className="text-lg font-extrabold text-slate-900">
                          S/ {formatoPrecio(totalCarrito)}
                        </span>
                      </div>

                      <button
                        onClick={continuar}
                        disabled={!tienda.abierto}
                        className="flex w-full items-center justify-center gap-1 rounded-xl bg-brand-600 py-2.5 text-xs font-bold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                      >
                        Continuar <ChevronRight size={14} />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {paso === 2 && (
                <div>
                  <h2 className="mb-3 text-sm font-bold text-slate-800">
                    ¿Cómo quieres recibirlo?
                  </h2>

                  <div className="space-y-2.5">
                    <label
                      className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${
                        metodoEntrega === 'RECOJO'
                          ? 'border-brand-500 bg-brand-50'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="entrega"
                        checked={metodoEntrega === 'RECOJO'}
                        onChange={() => setMetodoEntrega('RECOJO')}
                        className="mt-0.5 h-4 w-4 text-brand-600"
                      />
                      <div>
                        <p className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                          <Home size={15} className="text-brand-600" /> Recojo en
                          tienda
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-500">
                          {tienda.direccion}
                        </p>
                        <p className="mt-0.5 text-[10px] font-semibold text-brand-700">
                          Sin costo adicional
                        </p>
                      </div>
                    </label>

                    <label
                      className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${
                        metodoEntrega === 'DELIVERY'
                          ? 'border-brand-500 bg-brand-50'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="entrega"
                        checked={metodoEntrega === 'DELIVERY'}
                        onChange={() => setMetodoEntrega('DELIVERY')}
                        className="mt-0.5 h-4 w-4 text-brand-600"
                      />
                      <div className="flex-1">
                        <p className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                          <Truck size={15} className="text-brand-600" /> Delivery
                          a domicilio
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-500">
                          Solo dentro de {Number(tienda.radio_entrega_km)} km
                        </p>
                      </div>
                    </label>
                  </div>

                  {metodoEntrega === 'DELIVERY' && (
                    <div className="mt-4 space-y-2.5">
                      <input
                        type="text"
                        value={cliente.direccion}
                        onChange={(e) =>
                          setCliente((actual) => ({
                            ...actual,
                            direccion: e.target.value,
                          }))
                        }
                        placeholder="Dirección completa (calle, número, distrito)"
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none transition focus:border-brand-500"
                      />
                      <input
                        type="text"
                        value={cliente.referencia}
                        onChange={(e) =>
                          setCliente((actual) => ({
                            ...actual,
                            referencia: e.target.value,
                          }))
                        }
                        placeholder="Referencia (opcional)"
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none transition focus:border-brand-500"
                      />

                      <button
                        onClick={solicitar}
                        disabled={geoLoading}
                        className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-brand-50 py-2 text-xs font-semibold text-brand-700 transition hover:bg-brand-100 disabled:opacity-60"
                      >
                        <MapPin size={13} />
                        {geoLoading
                          ? 'Ubicando...'
                          : 'Usar mi ubicación actual'}
                      </button>

                      {geoError && (
                        <p className="text-[10px] text-accent-600">{geoError}</p>
                      )}

                      <MapaEntrega
                        tienda={tienda}
                        posicion={ubicacionEntrega}
                        onSelect={setUbicacionEntrega}
                      />
                      <p className="text-[10px] text-slate-400">
                        Toca el mapa para marcar el punto exacto de entrega.
                      </p>

                      <div
                        className={`rounded-xl border px-3 py-2 text-[11px] ${
                          distanciaEntrega === null
                            ? 'border-slate-200 bg-slate-50 text-slate-500'
                            : dentroRadio
                              ? 'border-brand-200 bg-brand-50 text-brand-700'
                              : 'border-red-200 bg-red-50 text-red-700'
                        }`}
                      >
                        {distanciaEntrega === null ? (
                          'Marca tu punto de entrega en el mapa.'
                        ) : dentroRadio ? (
                          <span className="font-semibold">
                            A {formatearDistancia(distanciaEntrega)} de la
                            bodega. Estás dentro del radio de entrega.
                          </span>
                        ) : (
                          <span className="font-semibold">
                            Estás a {formatearDistancia(distanciaEntrega)} y la
                            bodega solo entrega hasta{' '}
                            {Number(tienda.radio_entrega_km)} km. Puedes elegir
                            recojo en tienda.
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                    <button
                      onClick={retroceder}
                      className="flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-800"
                    >
                      <ChevronLeft size={14} /> Atrás
                    </button>
                    <button
                      onClick={continuar}
                      disabled={!paso2Valido}
                      className="flex items-center gap-1 rounded-xl bg-brand-600 px-5 py-2 text-xs font-bold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      Continuar <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              )}

              {paso === 3 && (
                <div>
                  <h2 className="mb-1 text-sm font-bold text-slate-800">
                    Método de pago
                  </h2>
                  <p className="mb-3 text-[10px] text-slate-400">
                    Pago simulado para esta demostración
                  </p>

                  <div className="space-y-2.5">
                    {[
                      {
                        valor: 'YAPE',
                        etiqueta: 'Yape',
                        detalle: '987 654 321',
                        icono: QrCode,
                      },
                      {
                        valor: 'PLIN',
                        etiqueta: 'Plin',
                        detalle: '912 345 678',
                        icono: QrCode,
                      },
                      {
                        valor: 'CONTRA_ENTREGA',
                        etiqueta: 'Contra entrega',
                        detalle: 'Pagas al recibir tu pedido',
                        icono: CreditCard,
                      },
                    ].map((opcion) => {
                      const Icono = opcion.icono;
                      const activo = metodoPago === opcion.valor;

                      return (
                        <label
                          key={opcion.valor}
                          className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${
                            activo
                              ? 'border-brand-500 bg-brand-50'
                              : 'border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <input
                            type="radio"
                            name="pago"
                            checked={activo}
                            onChange={() => setMetodoPago(opcion.valor)}
                            className="mt-0.5 h-4 w-4 text-brand-600"
                          />
                          <div>
                            <p className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                              <Icono size={15} className="text-brand-600" />
                              {opcion.etiqueta}
                            </p>
                            <p className="mt-0.5 text-[11px] text-slate-500">
                              {opcion.detalle}
                            </p>
                          </div>
                        </label>
                      );
                    })}
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                    <button
                      onClick={retroceder}
                      className="flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-800"
                    >
                      <ChevronLeft size={14} /> Atrás
                    </button>
                    <button
                      onClick={continuar}
                      className="flex items-center gap-1 rounded-xl bg-brand-600 px-5 py-2 text-xs font-bold text-white transition hover:bg-brand-700"
                    >
                      Continuar <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              )}

              {paso === 4 && (
                <div>
                  <h2 className="mb-3 text-sm font-bold text-slate-800">
                    Confirma tu pedido
                  </h2>

                  <div className="space-y-2 rounded-xl bg-cream-100 p-3 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Productos</span>
                      <span className="font-semibold text-slate-800">
                        {cantidadCarrito}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Entrega</span>
                      <span className="font-semibold text-slate-800">
                        {metodoEntrega === 'RECOJO'
                          ? 'Recojo en tienda'
                          : 'Delivery'}
                      </span>
                    </div>
                    {metodoEntrega === 'DELIVERY' && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Distancia</span>
                        <span className="font-semibold text-brand-700">
                          {formatearDistancia(distanciaEntrega)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-slate-500">Pago</span>
                      <span className="font-semibold text-slate-800">
                        {metodoPago === 'YAPE'
                          ? 'Yape'
                          : metodoPago === 'PLIN'
                            ? 'Plin'
                            : 'Contra entrega'}
                      </span>
                    </div>
                    <div className="flex justify-between border-t border-slate-200 pt-2">
                      <span className="font-bold text-slate-700">Total</span>
                      <span className="text-base font-extrabold text-slate-900">
                        S/ {formatoPrecio(totalCarrito)}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 rounded-xl border border-brand-100 bg-brand-50 p-3">
                    <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-brand-700">
                      <MapPin size={11} />
                      {metodoEntrega === 'RECOJO'
                        ? 'Punto de recojo'
                        : 'Dirección de entrega'}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-700">
                      {metodoEntrega === 'RECOJO'
                        ? tienda.direccion
                        : `${cliente.direccion}${
                            cliente.referencia
                              ? ` - ${cliente.referencia}`
                              : ''
                          }`}
                    </p>
                  </div>

                  {!puedeConfirmar ? (
                    <div className="mt-3 rounded-xl border border-accent-200 bg-accent-50 p-3 text-[11px] text-accent-600">
                      <p className="font-semibold">
                        {estaAutenticado()
                          ? 'Esta cuenta es de bodeguero. Ingresa con una cuenta de cliente para comprar.'
                          : 'Inicia sesión para confirmar tu pedido y hacer seguimiento.'}
                      </p>
                      <button
                        type="button"
                        onClick={() =>
                          navigate('/', { state: { from: `/tienda/${id}` } })
                        }
                        className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl bg-brand-600 py-2 text-xs font-bold text-white transition hover:bg-brand-700"
                      >
                        <LogIn size={13} /> Iniciar sesión
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="mt-3 space-y-2">
                        <input
                          type="text"
                          value={cliente.nombre}
                          onChange={(e) =>
                            setCliente((actual) => ({
                              ...actual,
                              nombre: e.target.value,
                            }))
                          }
                          placeholder="Tu nombre completo"
                          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none transition focus:border-brand-500"
                        />
                        <input
                          type="tel"
                          inputMode="numeric"
                          maxLength={9}
                          value={cliente.telefono}
                          onChange={(e) =>
                            setCliente((actual) => ({
                              ...actual,
                              telefono: normalizarTelefono(e.target.value),
                            }))
                          }
                          placeholder="Teléfono / WhatsApp (9 dígitos)"
                          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none transition focus:border-brand-500"
                        />
                        {cliente.telefono && !esTelefonoValido(cliente.telefono) && (
                          <p className="text-[10px] font-medium text-accent-600">
                            Ingresa un celular peruano de 9 dígitos que empiece con 9.
                          </p>
                        )}
                      </div>

                      {errorPedido && (
                        <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[11px] font-medium text-red-700">
                          {errorPedido}
                        </p>
                      )}

                      <button
                        onClick={confirmarPedido}
                        disabled={enviando || !paso4Valido || !tienda.abierto}
                        className="mt-3 w-full rounded-xl bg-brand-600 py-2.5 text-xs font-bold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                      >
                        {enviando ? 'Enviando pedido...' : 'Confirmar pedido'}
                      </button>
                    </>
                  )}

                  <button
                    onClick={retroceder}
                    className="mt-2 flex w-full items-center justify-center gap-1 py-1.5 text-[11px] font-semibold text-slate-600 hover:text-slate-800"
                  >
                    <ChevronLeft size={13} /> Volver a pago
                  </button>
                </div>
              )}
            </div>

            {paso === 1 && itemsCarrito.length > 0 && (
              <div className="border-t border-slate-100 bg-white px-4 py-3">
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span>{cantidadCarrito} productos</span>
                  <span className="text-sm font-extrabold text-slate-900">
                    S/ {formatoPrecio(totalCarrito)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </aside>
      </main>
    </div>
  );
}
