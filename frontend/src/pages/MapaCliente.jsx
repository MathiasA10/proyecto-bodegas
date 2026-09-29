import { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import '../utils/fixLeafletIcon';
import { 
  Store, ShoppingCart, Check, ArrowLeft, Search, 
  MapPin, Phone, Navigation, Plus, Minus, Trash2 
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

  const [clienteForm, setClienteForm] = useState({ nombre: '', telefono: '', direccion: '' });
  const [mensajeExito, setMensajeExito] = useState('');
  const [enviando, setEnviando] = useState(false);
  const navigate = useNavigate();

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

  const handleConfirmarPedido = async (e) => {
    e.preventDefault();
    if (!bodegaActiva) return;
    setEnviando(true);
    try {
      const payload = {
        bodega_id: bodegaActiva.id,
        nombre_cliente: clienteForm.nombre,
        telefono_cliente: clienteForm.telefono,
        direccion_entrega: clienteForm.direccion,
        items: carrito
      };
      const res = await api.post('public/pedidos/crear/', payload);
      setMensajeExito(`¡Pedido #${res.data.pedido_id} enviado a ${bodegaActiva.nombre_comercial}! Total: S/. ${res.data.total.toFixed(2)}`);
      setCarrito([]);
      setClienteForm({ nombre: '', telefono: '', direccion: '' });
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
        <div className="bg-emerald-50 border-b border-emerald-200 px-6 py-2.5 text-emerald-800 text-xs font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Check size={16} className="text-emerald-600" />
            <span>{mensajeExito}</span>
          </div>
          <button onClick={() => setMensajeExito('')} className="underline text-[11px]">Cerrar</button>
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

        {/* Columna Derecha: Resumen de Pedido y Checkout */}
        <div className="w-full lg:w-80 xl:w-96 bg-white border-l flex flex-col justify-between h-auto lg:h-full z-10 shadow-sm">
          <div className="p-4 border-b flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingCart className="text-blue-600" size={18} />
              <h2 className="text-sm font-bold text-slate-800">Mi Orden</h2>
            </div>
            {carrito.length > 0 && (
              <button 
                onClick={() => setCarrito([])} 
                className="text-[11px] text-red-500 hover:text-red-700 flex items-center gap-0.5 font-medium"
              >
                <Trash2 size={12} /> Vaciar
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
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

                <div className="space-y-2">
                  {carrito.map((item) => (
                    <div key={item.id} className="flex justify-between items-center p-2.5 rounded-lg border border-slate-100 bg-white shadow-xs">
                      <div>
                        <p className="text-xs font-semibold text-slate-800">{item.nombre}</p>
                        <p className="text-[11px] text-slate-500">S/. {parseFloat(item.precio).toFixed(2)} c/u</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center border rounded-md">
                          <button 
                            onClick={() => modificarCantidad(item.id, -1)} 
                            className="p-1 text-slate-500 hover:bg-slate-100 rounded-l"
                          >
                            <Minus size={12} />
                          </button>
                          <span className="px-2 text-xs font-semibold text-slate-700">{item.cantidad}</span>
                          <button 
                            onClick={() => modificarCantidad(item.id, 1)} 
                            className="p-1 text-slate-500 hover:bg-slate-100 rounded-r"
                          >
                            <Plus size={12} />
                          </button>
                        </div>
                        <button 
                          onClick={() => eliminarDelCarrito(item.id)}
                          className="text-slate-300 hover:text-red-500 p-1"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {carrito.length > 0 && (
            <div className="p-4 border-t bg-slate-50/50">
              <div className="flex justify-between items-center mb-3">
                <span className="text-xs font-semibold text-slate-600">Total a pagar:</span>
                <span className="text-base font-extrabold text-slate-900">S/. {totalCarrito.toFixed(2)}</span>
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
                <input
                  type="text"
                  placeholder="Dirección o Referencia de entrega"
                  required
                  value={clienteForm.direccion}
                  onChange={(e) => setClienteForm({ ...clienteForm, direccion: e.target.value })}
                  className="w-full bg-white border border-slate-200 p-2 rounded-lg text-xs outline-none focus:border-blue-500"
                />
                <button
                  type="submit"
                  disabled={enviando}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-semibold py-2.5 rounded-lg text-xs transition shadow-sm"
                >
                  {enviando ? 'Enviando orden...' : 'Confirmar Pedido'}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}