import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import '../utils/fixLeafletIcon';
import { 
  Store, ShoppingCart, Check, ArrowLeft, Search, 
  MapPin, Phone, Navigation, Plus, Minus, Trash2,
  Truck, Home, CreditCard, QrCode, ChevronLeft, ChevronRight,
  CheckCircle2, AlertCircle, User, MapPin as MapPinIcon
} from 'lucide-react';

const LIMA_CENTRO = [-12.046374, -77.042793];

// Cálculo de distancia euclidiana esférica (Haversine en Km)
function calcularDistanciaKm(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return parseFloat((R * c).toFixed(2));
}

// Componente para animar el mapa cuando se selecciona una tienda de la lista
function CambiarCentroMapa({ coords }) {
  const map = useMap();
  useEffect(() => {
    if (coords) {
      map.flyTo(coords, 16, { duration: 1.5 });
    }
  }, [coords, map]);
  return null;
}

export default function MapaCliente() {
  const [bodegas, setBodegas] = useState([]);
  const [bodegaActiva, setBodegaActiva] = useState(null);
  const [filtro, setFiltro] = useState('');
  const [ubicacionUsuario, setUbicacionUsuario] = useState(null);
  const [carrito, setCarrito] = useState([]);
  const [centroMapa, setCentroMapa] = useState(LIMA_CENTRO);

  const [clienteForm, setClienteForm] = useState({ nombre: '', telefono: '', direccion: '', referencia: '' });
  const [mensajeExito, setMensajeExito] = useState('');
  const [ultimoPedidoId, setUltimoPedidoId] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const navigate = useNavigate();

  // Stepper state
  const [step, setStep] = useState(1); // 1=Carrito, 2=Entrega, 3=Pago, 4=Confirmar
  const [metodoEntrega, setMetodoEntrega] = useState('RECOJO'); // 'RECOJO' | 'DELIVERY'
  const [metodoPago, setMetodoPago] = useState('CONTRA_ENTREGA'); // 'YAPE' | 'PLIN' | 'CONTRA_ENTREGA'

  useEffect(() => {
    cargarBodegas();
    obtenerUbicacionActual();
  }, []);

  const cargarBodegas = async () => {
    try {
      const res = await api.get('public/bodegas/');
      setBodegas(res.data);
    } catch (err) {
      console.error('Error al obtener bodegas:', err);
    }
  };

  const obtenerUbicacionActual = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords = [pos.coords.latitude, pos.coords.longitude];
          setUbicacionUsuario(coords);
          setCentroMapa(coords);
        },
        () => console.log('Ubicación denegada, usando Lima Centro por defecto')
      );
    }
  };

  // Filtrado por nombre de bodega, dirección o producto del catálogo
  const bodegasFiltradas = useMemo(() => {
    const q = filtro.toLowerCase().trim();
    return bodegas
      .map(b => {
        const distancia = ubicacionUsuario
          ? calcularDistanciaKm(ubicacionUsuario[0], ubicacionUsuario[1], parseFloat(b.latitud), parseFloat(b.longitud))
          : null;
        return { ...b, distancia };
      })
      .filter(b => {
        if (!q) return true;
        const coincideNombre = b.nombre_comercial.toLowerCase().includes(q);
        const coincideDireccion = b.direccion.toLowerCase().includes(q);
        const coincideProducto = b.productos?.some(p => p.nombre.toLowerCase().includes(q));
        return coincideNombre || coincideDireccion || coincideProducto;
      })
      .sort((a, b) => (a.distancia ?? 9999) - (b.distancia ?? 9999));
  }, [bodegas, filtro, ubicacionUsuario]);

  const seleccionarBodega = (bodega) => {
    setBodegaActiva(bodega);
    setCentroMapa([parseFloat(bodega.latitud), parseFloat(bodega.longitud)]);
  };

  const agregarAlCarrito = (bodega, producto) => {
    if (bodegaActiva && bodegaActiva.id !== bodega.id && carrito.length > 0) {
      if (!confirm('Solo puedes pedir de una bodega a la vez. ¿Deseas vaciar el pedido anterior?')) return;
      setCarrito([]);
    }
    setBodegaActiva(bodega);

    setCarrito(prev => {
      const existe = prev.find(item => item.id === producto.id);
      if (existe) {
        if (existe.cantidad >= producto.stock) {
          alert(`Stock máximo alcanzado (${producto.stock} disponibles)`);
          return prev;
        }
        return prev.map(item => item.id === producto.id ? { ...item, cantidad: item.cantidad + 1 } : item);
      }
      return [...prev, { ...producto, cantidad: 1 }];
    });
  };

  const modificarCantidad = (id, delta) => {
    setCarrito(prev => prev.map(item => {
      if (item.id === id) {
        const nueva = item.cantidad + delta;
        return nueva > 0 ? { ...item, cantidad: nueva } : item;
      }
      return item;
    }));
  };

  const eliminarDelCarrito = (id) => {
    setCarrito(prev => prev.filter(item => item.id !== id));
  };

  const totalCarrito = carrito.reduce((acc, p) => acc + (parseFloat(p.precio) * p.cantidad), 0);

  // Stepper validation & navigation
  const validarPasoActual = useCallback(() => {
    if (step === 1) return carrito.length > 0;
    if (step === 2) return metodoEntrega === 'RECOJO' || clienteForm.direccion.trim() !== '';
    if (step === 3) return true;
    return true;
  }, [step, carrito, metodoEntrega, clienteForm.direccion]);

  const siguientePaso = () => {
    if (step < 4 && validarPasoActual()) {
      setStep(prev => prev + 1);
    }
  };

  const pasoAnterior = () => {
    if (step > 1) {
      setStep(prev => prev - 1);
    }
  };

  const handleConfirmarPedido = async (e) => {
    e.preventDefault();
    if (!bodegaActiva) return;
    setEnviando(true);
    try {
      const direccionFinal = metodoEntrega === 'RECOJO' ? bodegaActiva.direccion : clienteForm.direccion;
      const payload = {
        bodega_id: bodegaActiva.id,
        nombre_cliente: clienteForm.nombre,
        telefono_cliente: clienteForm.telefono,
        direccion_entrega: direccionFinal,
        metodo_entrega: metodoEntrega,
        metodo_pago: metodoPago,
        items: carrito
      };
      const res = await api.post('public/pedidos/crear/', payload);
      setMensajeExito(`¡Pedido #${res.data.pedido_id} enviado a ${bodegaActiva.nombre_comercial}! Total: S/. ${res.data.total.toFixed(2)}`);
      setUltimoPedidoId(res.data.pedido_id);
      setCarrito([]);
      setClienteForm({ nombre: '', telefono: '', direccion: '', referencia: '' });
      setStep(1);
      setMetodoEntrega('RECOJO');
      setMetodoPago('CONTRA_ENTREGA');
      cargarBodegas();
    } catch (err) {
      alert(err.response?.data?.error || 'Error al tramitar la orden');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-slate-100 overflow-hidden font-sans">
      {/* Top Navbar */}
      <header className="bg-white border-b px-6 py-3 flex items-center justify-between shadow-sm z-10">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-600 rounded-xl text-white">
            <Store size={22} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800 leading-tight">Bodegas Cercanas</h1>
            <p className="text-xs text-slate-500">Lima Metropolitana y Alrededores</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button 
            onClick={obtenerUbicacionActual}
            className="hidden md:flex items-center gap-1 text-xs font-medium text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition"
          >
            <Navigation size={14} /> Usar mi ubicación
          </button>
          <button 
            onClick={() => navigate('/')} 
            className="flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900 border px-3 py-1.5 rounded-lg hover:bg-slate-50 transition"
          >
            <ArrowLeft size={14} /> Acceso Bodegueros
          </button>
        </div>
      </header>

      {/* Alerta de Pedido Exitoso */}
      {mensajeExito && (
        <div className="bg-emerald-50 border-b border-emerald-200 px-6 py-2.5 text-emerald-800 text-xs font-medium flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Check size={16} className="text-emerald-600" />
            <span>{mensajeExito}</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setMensajeExito('')} className="underline text-[11px]">Cerrar</button>
            {ultimoPedidoId && (
              <button 
                onClick={() => navigate(`/pedido/${ultimoPedidoId}/seguimiento`)}
                className="px-3 py-1.5 bg-emerald-600 text-white text-[11px] rounded-lg hover:bg-emerald-700 transition flex items-center gap-1"
              >
                <Truck size={12} /> Ver seguimiento
              </button>
            )}
          </div>
        </div>
      )}

      {/* Panel Principal */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        
        {/* Columna Izquierda: Buscador y Lista de Tiendas */}
        <div className="w-full lg:w-80 xl:w-96 bg-white border-r flex flex-col h-1/3 lg:h-full z-10 shadow-sm">
          <div className="p-4 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
              <input
                type="text"
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
                placeholder="Buscar bodega, calle o producto..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-blue-500 focus:bg-white transition"
              />
            </div>
            <div className="flex justify-between items-center mt-2 px-1 text-[11px] text-slate-500 font-medium">
              <span>{bodegasFiltradas.length} tiendas encontradas</span>
              {ubicacionUsuario && <span className="text-blue-600">Ordenado por cercanía</span>}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y">
            {bodegasFiltradas.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                No hay bodegas registradas con ese criterio.
              </div>
            ) : (
              bodegasFiltradas.map((b) => (
                <div
                  key={b.id}
                  onClick={() => seleccionarBodega(b)}
                  className={`p-4 cursor-pointer transition flex flex-col gap-1.5 ${
                    bodegaActiva?.id === b.id ? 'bg-blue-50/70 border-l-4 border-blue-600' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <h3 className="text-xs font-bold text-slate-800">{b.nombre_comercial}</h3>
                    {b.distancia !== null && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full">
                        {b.distancia} km
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 flex items-center gap-1">
                    <MapPin size={12} className="shrink-0 text-slate-400" />
                    <span className="truncate">{b.direccion}</span>
                  </p>
                  <div className="flex items-center justify-between text-[11px] pt-1">
                    <span className="text-slate-500 flex items-center gap-1">
                      <Phone size={11} className="text-slate-400" /> {b.telefono || 'Sin número'}
                    </span>
                    <span className="text-[10px] font-medium text-blue-600">
                      {b.productos?.length || 0} productos
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Columna Central: Mapa Interactivo */}
        <div className="flex-1 relative h-2/3 lg:h-full">
          <MapContainer center={LIMA_CENTRO} zoom={13} className="h-full w-full">
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <CambiarCentroMapa coords={centroMapa} />

            {bodegasFiltradas.map((b) => (
              <Marker 
                key={b.id} 
                position={[parseFloat(b.latitud), parseFloat(b.longitud)]}
                eventHandlers={{
                  click: () => seleccionarBodega(b)
                }}
              >
                <Popup className="custom-popup">
                  <div className="p-1 min-w-[200px]">
                    <h3 className="font-bold text-sm text-slate-900">{b.nombre_comercial}</h3>
                    <p className="text-[11px] text-slate-500">{b.direccion}</p>
                    {b.distancia !== null && (
                      <p className="text-[10px] font-semibold text-emerald-700 mt-0.5">A {b.distancia} km de ti</p>
                    )}

                    <div className="mt-3 border-t pt-2 max-h-48 overflow-y-auto">
                      <span className="text-[11px] font-semibold text-slate-700 block mb-1">Catálogo Disponible:</span>
                      {b.productos?.length === 0 ? (
                        <p className="text-[11px] text-slate-400 italic">No hay productos en inventario.</p>
                      ) : (
                        <div className="space-y-1.5">
                          {b.productos.map((prod) => (
                            <div key={prod.id} className="flex justify-between items-center text-xs py-1 border-b border-slate-100">
                              <div>
                                <div className="font-medium text-slate-800">{prod.nombre}</div>
                                <div className="text-[10px] text-slate-500">S/. {parseFloat(prod.precio).toFixed(2)} (Stock: {prod.stock})</div>
                              </div>
                              <button
                                onClick={() => agregarAlCarrito(b, prod)}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1 rounded-md text-[11px] font-medium transition flex items-center gap-1"
                              >
                                <Plus size={12} /> Pedir
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>

        {/* Columna Derecha: Stepper Checkout */}
        <div className="w-full lg:w-80 xl:w-96 bg-white border-l flex flex-col h-auto lg:h-full z-10 shadow-sm">
          {/* Stepper Progress Indicator */}
          <div className="px-4 py-3 border-b bg-slate-50">
            <div className="flex items-center justify-between">
              {[
                { num: 1, label: 'Carrito', icon: ShoppingCart },
                { num: 2, label: 'Entrega', icon: Truck },
                { num: 3, label: 'Pago', icon: CreditCard },
                { num: 4, label: 'Confirmar', icon: CheckCircle2 }
              ].map((s, idx) => (
                <React.Fragment key={s.num}>
                  <div className="flex items-center">
                    <div className="flex items-center">
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                          step > s.num
                            ? 'bg-green-600 text-white'
                            : step === s.num
                            ? 'bg-blue-600 text-white ring-2 ring-blue-600 ring-offset-2'
                            : 'bg-slate-200 text-slate-500'
                        }`}
                      >
                        {step > s.num ? <Check size={12} /> : <s.icon size={14} />}
                      </div>
                      <span className={`ml-2 text-xs font-medium hidden sm:block ${
                        step >= s.num ? 'text-slate-800' : 'text-slate-400'
                      }`}>{s.label}</span>
                    </div>
                    {idx < 3 && (
                      <div
                        className={`hidden lg:block w-12 h-0.5 mx-1 ${
                          step > s.num ? 'bg-green-500' : 'bg-slate-200'
                        }`}
                      />
                    )}
                  </div>
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Step Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Paso 1: Carrito */}
            {step === 1 && (
              <div>
                {carrito.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 py-12">
                    <ShoppingCart size={36} className="text-slate-200 mb-2" />
                    <p className="text-xs">El carrito está vacío.</p>
                    <p className="text-[11px] text-slate-400 mt-1">Selecciona una bodega en el mapa y agrega productos.</p>
                  </div>
                ) : (
                  <div>
                    <div className="text-xs bg-slate-50 border p-2.5 rounded-lg mb-3">
                      <span className="text-slate-500 block text-[10px] font-medium">BODEGA SELECCIONADA</span>
                      <span className="font-bold text-slate-800">{bodegaActiva?.nombre_comercial}</span>
                    </div>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {carrito.map((item) => (
                        <div key={item.id} className="flex justify-between items-center p-2.5 rounded-lg border border-slate-100 bg-white shadow-xs">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-slate-800 truncate">{item.nombre}</p>
                            <p className="text-[11px] text-slate-500">S/. {parseFloat(item.precio).toFixed(2)} c/u</p>
                          </div>
                          <div className="flex items-center gap-2 ml-2">
                            <div className="flex items-center border rounded-md">
                              <button onClick={() => modificarCantidad(item.id, -1)} className="p-1 text-slate-500 hover:bg-slate-100 rounded-l"><Minus size={12} /></button>
                              <span className="px-2 text-xs font-semibold text-slate-700">{item.cantidad}</span>
                              <button onClick={() => modificarCantidad(item.id, 1)} className="p-1 text-slate-500 hover:bg-slate-100 rounded-r"><Plus size={12} /></button>
                            </div>
                            <button onClick={() => eliminarDelCarrito(item.id)} className="text-slate-300 hover:text-red-500 p-1"><Trash2 size={13} /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between items-center mt-3 pt-3 border-t">
                      <span className="text-xs font-semibold text-slate-600">Total:</span>
                      <span className="text-base font-extrabold text-slate-900">S/. {totalCarrito.toFixed(2)}</span>
                    </div>
                    <button
                      onClick={siguientePaso}
                      disabled={!validarPasoActual()}
                      className="w-full mt-4 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-semibold py-2.5 rounded-lg text-xs transition"
                    >
                      Continuar <ChevronRight size={14} className="inline ml-1" />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Paso 2: Método de Entrega */}
            {step === 2 && (
              <div>
                <h3 className="text-sm font-semibold text-slate-800 mb-4">Método de Entrega</h3>
                <div className="space-y-3">
                  <label className={`flex items-center p-3 border rounded-lg cursor-pointer transition ${
                    metodoEntrega === 'RECOJO' ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'
                  }`}>
                    <input
                      type="radio"
                      name="metodoEntrega"
                      value="RECOJO"
                      checked={metodoEntrega === 'RECOJO'}
                      onChange={() => setMetodoEntrega('RECOJO')}
                      className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500"
                    />
                    <div className="ml-3 flex-1">
                      <div className="flex items-center gap-2">
                        <Home className="text-green-600" size={20} />
                        <span className="font-medium text-slate-800">Recojo en tienda</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1 ml-6">
                        {bodegaActiva?.direccion || 'Selecciona una bodega primero'}
                      </p>
                    </div>
                  </label>

                  <label className={`flex items-center p-3 border rounded-lg cursor-pointer transition ${
                    metodoEntrega === 'DELIVERY' ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'
                  }`}>
                    <input
                      type="radio"
                      name="metodoEntrega"
                      value="DELIVERY"
                      checked={metodoEntrega === 'DELIVERY'}
                      onChange={() => setMetodoEntrega('DELIVERY')}
                      className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500"
                    />
                    <div className="ml-3 flex-1">
                      <div className="flex items-center gap-2">
                        <Truck className="text-blue-600" size={20} />
                        <span className="font-medium text-slate-800">Despacho a domicilio</span>
                      </div>
                      {metodoEntrega === 'DELIVERY' && (
                        <div className="mt-3 ml-6 space-y-2">
                          <input
                            type="text"
                            placeholder="Dirección completa (calle, número, distrito)"
                            required
                            value={clienteForm.direccion}
                            onChange={(e) => setClienteForm({ ...clienteForm, direccion: e.target.value })}
                            className="w-full bg-white border border-slate-200 p-2 rounded-lg text-xs outline-none focus:border-blue-500"
                          />
                          <input
                            type="text"
                            placeholder="Referencia (opcional): frente al parque, casa azul, etc."
                            value={clienteForm.referencia || ''}
                            onChange={(e) => setClienteForm({ ...clienteForm, referencia: e.target.value })}
                            className="w-full bg-white border border-slate-200 p-2 rounded-lg text-xs outline-none focus:border-blue-500"
                          />
                        </div>
                      )}
                    </div>
                  </label>
                </div>

                <div className="flex justify-between mt-6 pt-4 border-t">
                  <button onClick={pasoAnterior} className="text-slate-600 hover:text-slate-800 text-xs font-medium flex items-center gap-1">
                    <ChevronLeft size={14} /> Atrás
                  </button>
                  <button
                    onClick={siguientePaso}
                    disabled={!validarPasoActual()}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-semibold py-2 px-6 rounded-lg text-xs transition flex items-center gap-1"
                  >
                    Continuar <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}

            {/* Paso 3: Método de Pago */}
            {step === 3 && (
              <div>
                <h3 className="text-sm font-semibold text-slate-800 mb-4">Método de Pago <span className="text-xs text-slate-400 font-normal ml-2">(Simulado)</span></h3>
                <div className="space-y-3">
                  {[
                    { value: 'YAPE', label: 'Yape', icon: QrCode, color: 'text-purple-600', numero: '987 654 321', bg: 'bg-purple-50', border: 'border-purple-200' },
                    { value: 'PLIN', label: 'Plin', icon: QrCode, color: 'text-blue-600', numero: '912 345 678', bg: 'bg-blue-50', border: 'border-blue-200' },
                    { value: 'CONTRA_ENTREGA', label: 'Contra entrega', icon: CreditCard, color: 'text-green-600', numero: 'Pago al recibir', bg: 'bg-green-50', border: 'border-green-200' }
                  ].map(opt => (
                    <label
                      key={opt.value}
                      className={`flex items-center p-3 border rounded-lg cursor-pointer transition ${metodoPago === opt.value ? `border-${opt.color.replace('text-', '')} ${opt.bg}` : 'border-slate-200 hover:border-slate-300'}`}
                    >
                      <input
                        type="radio"
                        name="metodoPago"
                        value={opt.value}
                        checked={metodoPago === opt.value}
                        onChange={() => setMetodoPago(opt.value)}
                        className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500"
                      />
                      <div className="ml-3 flex-1">
                        <div className="flex items-center gap-2">
                          <opt.icon className={`${opt.color}`} size={20} />
                          <span className="font-medium text-slate-800">{opt.label}</span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1 ml-6">{opt.numero}</p>
                        {(opt.value === 'YAPE' || opt.value === 'PLIN') && metodoPago === opt.value && (
                          <div className="mt-2 ml-6 flex items-center gap-2">
                            <div className="w-20 h-20 bg-slate-100 rounded flex items-center justify-center border">
                              <QrCode size={24} className="text-slate-400" />
                            </div>
                            <span className="text-[10px] text-slate-500">Escanea para pagar (simulado)</span>
                          </div>
                        )}
                      </div>
                    </label>
                  ))}
                </div>

                <div className="flex justify-between mt-6 pt-4 border-t">
                  <button onClick={pasoAnterior} className="text-slate-600 hover:text-slate-800 text-xs font-medium flex items-center gap-1">
                    <ChevronLeft size={14} /> Atrás
                  </button>
                  <button
                    onClick={siguientePaso}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg text-xs transition flex items-center gap-1"
                  >
                    Continuar <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}

            {/* Paso 4: Confirmación */}
            {step === 4 && (
              <div>
                <h3 className="text-sm font-semibold text-slate-800 mb-4">Confirmar Pedido</h3>
                <div className="space-y-4">
                  <div className="bg-slate-50 border p-3 rounded-lg">
                    <div className="flex justify-between text-xs mb-2">
                      <span className="text-slate-500">Subtotal</span>
                      <span className="font-semibold text-slate-800">S/. {totalCarrito.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">Entrega</span>
                      <span className="font-semibold text-slate-800">
                        {metodoEntrega === 'RECOJO' ? 'Recojo en tienda (S/. 0.00)' : 'Delivery (S/. 0.00)'}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs border-t pt-2 mt-2">
                      <span className="font-semibold text-slate-800">Total</span>
                      <span className="font-extrabold text-slate-900">S/. {totalCarrito.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
                    <p className="text-xs font-medium text-blue-800 mb-2 flex items-center gap-1">
                      <MapPinIcon size={12} /> Dirección de entrega
                    </p>
                    <p className="text-xs text-blue-700">
                      {metodoEntrega === 'RECOJO' 
                        ? `${bodegaActiva?.direccion || 'Sin dirección'} (Recojo en tienda)`
                        : `${clienteForm.direccion}${clienteForm.referencia ? ` - ${clienteForm.referencia}` : ''}`}
                    </p>
                  </div>

                  <div className="bg-green-50 border border-green-200 p-3 rounded-lg">
                    <p className="text-xs font-medium text-green-800 mb-2 flex items-center gap-1">
                      <CreditCard size={12} /> Método de pago
                    </p>
                    <p className="text-xs text-green-700">
                      {metodoPago === 'YAPE' ? 'Yape (simulado)' : metodoPago === 'PLIN' ? 'Plin (simulado)' : 'Contra entrega'}
                    </p>
                  </div>

                  <form onSubmit={handleConfirmarPedido} className="space-y-2">
                    <input
                      type="text"
                      placeholder="Tu Nombre Completo"
                      required
                      value={clienteForm.nombre}
                      onChange={(e) => setClienteForm({ ...clienteForm, nombre: e.target.value })}
                      className="w-full bg-white border border-slate-200 p-2 rounded-lg text-xs outline-none focus:border-blue-500"
                    />
                    <input
                      type="tel"
                      placeholder="Teléfono / WhatsApp"
                      required
                      value={clienteForm.telefono}
                      onChange={(e) => setClienteForm({ ...clienteForm, telefono: e.target.value })}
                      className="w-full bg-white border border-slate-200 p-2 rounded-lg text-xs outline-none focus:border-blue-500"
                    />
                    {metodoEntrega === 'DELIVERY' && (
                      <input
                        type="text"
                        placeholder="Dirección de entrega (confirmación)"
                        required
                        value={clienteForm.direccion}
                        onChange={(e) => setClienteForm({ ...clienteForm, direccion: e.target.value })}
                        className="w-full bg-white border border-slate-200 p-2 rounded-lg text-xs outline-none focus:border-blue-500"
                      />
                    )}
                    <button
                      type="submit"
                      disabled={enviando}
                      className="w-full bg-green-600 hover:bg-green-700 disabled:bg-slate-300 text-white font-semibold py-2.5 rounded-lg text-xs transition shadow-sm"
                    >
                      {enviando ? 'Enviando orden...' : 'Confirmar Pedido'}
                    </button>
                  </form>

                  <button
                    onClick={pasoAnterior}
                    className="w-full text-center text-slate-600 hover:text-slate-800 text-xs font-medium py-2"
                  >
                    <ChevronLeft size={14} className="inline mr-1" /> Volver a pago
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}