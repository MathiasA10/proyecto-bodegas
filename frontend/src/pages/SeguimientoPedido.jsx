import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import api from '../api/client';
import '../utils/fixLeafletIcon';
import { 
  Store, MapPin, Truck, Home, Navigation, 
  ArrowLeft, Loader2, AlertCircle, CheckCircle2,
  User, Clock, Package
} from 'lucide-react';

const LIMA_CENTRO = [-12.046374, -77.042793];

function MapAnimator({ coords, zoom = 15 }) {
  const map = useMap();
  useEffect(() => {
    if (coords) {
      map.flyTo(coords, zoom, { duration: 1.5 });
    }
  }, [coords, map, zoom]);
  return null;
}

export default function SeguimientoPedido() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [pedido, setPedido] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [repartidorPos, setRepartidorPos] = useState(null);
  const intervalRef = useRef(null);

  useEffect(() => {
    cargarPedido();
    // Polling cada 5 segundos para actualizar posición del repartidor
    intervalRef.current = setInterval(cargarPedido, 5000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [id]);

  const cargarPedido = async () => {
    try {
      const res = await api.get(`public/pedidos/${id}/seguimiento/`);
      const data = res.data;
      setPedido(data);
      if (data.repartidor) {
        setRepartidorPos([data.repartidor.latitud, data.repartidor.longitud]);
      }
      setError('');
    } catch (err) {
      setError('Error al cargar el seguimiento del pedido');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getEstadoInfo = (estado) => {
    const estados = {
      'PENDIENTE': { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
      'EN_PREPARACIÓN': { label: 'En preparación', color: 'bg-blue-100 text-blue-800', icon: Package },
      'EN_CAMINO': { label: 'En camino', color: 'bg-purple-100 text-purple-800', icon: Truck },
      'ENTREGADO': { label: 'Entregado', color: 'bg-green-100 text-green-800', icon: CheckCircle2 },
      'CANCELADO': { label: 'Cancelado', color: 'bg-red-100 text-red-800', icon: AlertCircle },
    };
    return estados[estado] || { label: estado, color: 'bg-gray-100 text-gray-800', icon: Clock };
  };

  const formatFecha = (fechaStr) => {
    const fecha = new Date(fechaStr);
    return fecha.toLocaleString('es-PE', { 
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  if (loading && !pedido) {
    return (
      <div className="h-screen flex flex-col bg-slate-100">
        <header className="bg-white border-b px-6 py-3 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 rounded-xl text-white"><Store size={22} /></div>
            <div>
              <h1 className="text-lg font-bold text-slate-800">Seguimiento de Pedido</h1>
              <p className="text-xs text-slate-500">Cargando...</p>
            </div>
          </div>
        </header>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
        </div>
      </div>
    );
  }

  if (error && !pedido) {
    return (
      <div className="h-screen flex flex-col bg-slate-100">
        <header className="bg-white border-b px-6 py-3 flex items-center justify-between shadow-sm">
          <button onClick={() => navigate('/mapa')} className="flex items-center gap-1 text-slate-600 hover:text-slate-900">
            <ArrowLeft size={20} /> Volver
          </button>
        </header>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center p-6">
            <AlertCircle size={48} className="mx-auto mb-4 text-red-500" />
            <h2 className="text-lg font-semibold text-gray-800 mb-2">Error</h2>
            <p className="text-gray-500 mb-4">{error}</p>
            <button onClick={() => navigate('/mapa')} className="px-4 py-2 bg-blue-600 text-white rounded-lg">
              Volver al mapa
            </button>
          </div>
        </div>
      </div>
    );
  }

  const estadoInfo = getEstadoInfo(pedido.estado);
  const EstadoIcon = estadoInfo.icon;

  const centerMap = repartidorPos 
    ? repartidorPos 
    : pedido.bodega 
      ? [pedido.bodega.latitud, pedido.bodega.longitud] 
      : LIMA_CENTRO;

  return (
    <div className="h-screen flex flex-col bg-slate-100 overflow-hidden">
      {/* Top Navbar */}
      <header className="bg-white border-b px-6 py-3 flex items-center justify-between shadow-sm z-10">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/mapa')} className="p-2 text-slate-500 hover:text-slate-700 rounded-lg hover:bg-slate-100">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-lg font-bold text-slate-800">Seguimiento Pedido #{pedido.pedido_id}</h1>
            <p className="text-xs text-slate-500">Estado: {estadoInfo.label}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${estadoInfo.color}`}>
            <EstadoIcon size={10} className="inline mr-1" /> {estadoInfo.label}
          </span>
        </div>
      </header>

      {/* Panel Principal */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Columna Izquierda: Info del pedido */}
        <div className="w-full lg:w-72 bg-white border-r flex flex-col h-1/3 lg:h-full shadow-sm">
          <div className="p-4 border-b">
            <h2 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
              <Package size={16} className="text-blue-600" /> Detalles del Pedido
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="bg-slate-50 border p-3 rounded-lg">
              <p className="text-xs text-slate-500 font-medium mb-1">BODEGA</p>
              <div className="flex items-center gap-2">
                <Store className="text-blue-600" size={20} />
                <div>
                  <p className="font-semibold text-slate-800">{pedido.bodega.nombre}</p>
                  <p className="text-xs text-slate-500">{pedido.bodega.direccion}</p>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 border p-3 rounded-lg">
              <p className="text-xs text-slate-500 font-medium mb-1">CLIENTE</p>
              <div className="flex items-center gap-2">
                <User className="text-green-600" size={20} />
                <div>
                  <p className="font-semibold text-slate-800">{pedido.nombre_cliente}</p>
                  <p className="text-xs text-slate-500">{pedido.telefono_cliente}</p>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 border p-3 rounded-lg">
              <p className="text-xs text-slate-500 font-medium mb-1">ENTREGA</p>
              <div className="flex items-center gap-2">
                <MapPin className="text-red-600" size={20} />
                <p className="text-xs text-slate-700">{pedido.direccion_entrega}</p>
              </div>
            </div>

            <div className="bg-slate-50 border p-3 rounded-lg">
              <p className="text-xs text-slate-500 font-medium mb-1">TOTAL</p>
              <p className="text-xl font-bold text-slate-900">S/. {parseFloat(pedido.total).toFixed(2)}</p>
            </div>

            <div className="bg-slate-50 border p-3 rounded-lg">
              <p className="text-xs text-slate-500 font-medium mb-1">FECHA</p>
              <p className="text-xs text-slate-700">{formatFecha(pedido.created_at)}</p>
            </div>
          </div>

          <div className="p-4 border-t bg-slate-50">
            <div className="text-center text-xs text-slate-500">
              Actualizando posición cada 5s...
            </div>
          </div>
        </div>

        {/* Columna Central: Mapa */}
        <div className="flex-1 relative">
          <MapContainer center={centerMap} zoom={14} className="h-full w-full">
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <MapAnimator coords={centerMap} />
            
            {/* Bodega (origen) */}
            {pedido.bodega && (
              <Marker position={[pedido.bodega.latitud, pedido.bodega.longitud]}>
                <Popup>
                  <div className="p-1 min-w-[180px]">
                    <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1">
                      <Store className="text-blue-600" size={14} /> {pedido.bodega.nombre}
                    </h3>
                    <p className="text-[11px] text-slate-500">{pedido.bodega.direccion}</p>
                    <div className="mt-2 text-[10px] text-blue-600 font-medium">Punto de origen</div>
                  </div>
                </Popup>
                <div className="bg-blue-600 text-white p-2 rounded-full shadow-lg">
                  🏪
                </div>
              </Marker>
            )}

            {/* Cliente (destino) */}
            {pedido.direccion_entrega && (
              <Marker position={centerMap}>
                <Popup>
                  <div className="p-1 min-w-[180px]">
                    <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1">
                      <Home className="text-green-600" size={14} /> Destino de entrega
                    </h3>
                    <p className="text-[11px] text-slate-500">{pedido.direccion_entrega}</p>
                    <div className="mt-2 text-[10px] text-green-600 font-medium">Punto de destino</div>
                  </div>
                </Popup>
                <div className="bg-green-600 text-white p-2 rounded-full shadow-lg">
                  🏠
                </div>
              </Marker>
            )}

            {/* Repartidor (tiempo real) */}
            {repartidorPos && (
              <Marker position={repartidorPos}>
                <Popup>
                  <div className="p-1 min-w-[180px] text-center">
                    <div className="bg-purple-600 text-white p-2 rounded-full shadow-lg inline-block mb-2">
                      🛵
                    </div>
                    <h3 className="font-bold text-sm text-slate-900">Repartidor en camino</h3>
                    <p className="text-[11px] text-slate-500">Tu pedido viene en camino</p>
                    <div className="mt-2 text-[10px] text-purple-600 font-medium">Posición actual</div>
                  </div>
                </Popup>
                <div className="bg-purple-600 text-white p-2 rounded-full shadow-lg animate-bounce">
                  🛵
                </div>
              </Marker>
            )}
          </MapContainer>

          {/* Leyenda del mapa */}
          <div className="absolute bottom-4 left-4 right-4 lg:left-auto lg:right-4 lg:w-64 bg-white/95 backdrop-blur rounded-lg shadow-lg p-3">
            <div className="flex items-center gap-2 text-xs mb-2">
              <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-white text-[10px]">🏪</div>
              <span className="text-slate-700">Bodega (origen)</span>
            </div>
            <div className="flex items-center gap-2 text-xs mb-2">
              <div className="w-6 h-6 bg-green-600 rounded-full flex items-center justify-center text-white text-[10px]">🏠</div>
              <span className="text-slate-700">Destino entrega</span>
            </div>
            {repartidorPos && (
              <div className="flex items-center gap-2 text-xs">
                <div className="w-6 h-6 bg-purple-600 rounded-full flex items-center justify-center text-white text-[10px] animate-bounce">🛵</div>
                <span className="text-slate-700">Repartidor (tiempo real)</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}