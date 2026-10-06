import { useState, useEffect } from 'react';
import api from '../api/client';
import { 
  ShoppingBag, CheckCircle2, AlertCircle, Truck, 
  MapPin, Phone, Clock, MoreVertical, MapPin as MapPinIcon,
  RefreshCw, Loader2
} from 'lucide-react';

const ESTADOS = [
  { value: 'PENDIENTE', label: 'Pendiente', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'EN_PREPARACIÓN', label: 'En preparación', color: 'bg-blue-100 text-blue-800' },
  { value: 'EN_CAMINO', label: 'En camino', color: 'bg-purple-100 text-purple-800' },
  { value: 'ENTREGADO', label: 'Entregado', color: 'bg-green-100 text-green-800' },
  { value: 'CANCELADO', label: 'Cancelado', color: 'bg-red-100 text-red-800' },
];

const TRANSICIONES_VALIDAS = {
  'PENDIENTE': ['EN_PREPARACIÓN', 'CANCELADO'],
  'EN_PREPARACIÓN': ['EN_CAMINO', 'CANCELADO'],
  'EN_CAMINO': ['ENTREGADO', 'CANCELADO'],
  'ENTREGADO': [],
  'CANCELADO': [],
};

export default function BodegaPedidos() {
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mensaje, setMensaje] = useState({ tipo: '', texto: '' });
  const [modalRepartidor, setModalRepartidor] = useState(null);
  const [repartidorPos, setRepartidorPos] = useState({ lat: -12.046374, lng: -77.042793 });
  const [guardandoRepartidor, setGuardandoRepartidor] = useState(false);

  useEffect(() => {
    cargarPedidos();
  }, []);

  const cargarPedidos = async () => {
    setLoading(true);
    try {
      const res = await api.get('bodega/pedidos/');
      setPedidos(res.data);
    } catch (err) {
      console.error('Error al cargar pedidos:', err);
      setMensaje({ tipo: 'error', texto: 'Error al cargar los pedidos' });
    } finally {
      setLoading(false);
    }
  };

  const handleCambiarEstado = async (pedidoId, nuevoEstado) => {
    try {
      await api.patch(`bodega/pedidos/${pedidoId}/estado/`, { estado: nuevoEstado });
      setMensaje({ tipo: 'success', texto: `Estado actualizado a ${nuevoEstado}` });
      cargarPedidos();
    } catch (err) {
      const errMsg = err.response?.data?.error || 'Error al cambiar estado';
      setMensaje({ tipo: 'error', texto: errMsg });
    }
  };

  const abrirModalRepartidor = (pedido) => {
    setModalRepartidor(pedido);
    setRepartidorPos({ lat: -12.046374, lng: -77.042793 });
  };

  const cerrarModalRepartidor = () => {
    setModalRepartidor(null);
  };

  const handleMapClick = (e) => {
    setRepartidorPos({ lat: e.latlng.lat, lng: e.latlng.lng });
  };

  const guardarRepartidor = async () => {
    if (!modalRepartidor) return;
    setGuardandoRepartidor(true);
    try {
      await api.patch(`bodega/pedidos/${modalRepartidor.id}/repartidor/`, {
        repartidor_lat: repartidorPos.lat,
        repartidor_lng: repartidorPos.lng
      });
      setMensaje({ tipo: 'success', texto: 'Ubicación del repartidor actualizada' });
      cerrarModalRepartidor();
      cargarPedidos();
    } catch (err) {
      const errMsg = err.response?.data?.error || 'Error al guardar ubicación';
      setMensaje({ tipo: 'error', texto: errMsg });
    } finally {
      setGuardandoRepartidor(false);
    }
  };

  const getTransicionesValidas = (estadoActual) => {
    return TRANSICIONES_VALIDAS[estadoActual] || [];
  };

  const puedeCambiarA = (estadoActual, nuevoEstado) => {
    if (estadoActual === 'ENTREGADO' || estadoActual === 'CANCELADO') return false;
    return getTransicionesValidas(estadoActual).includes(nuevoEstado);
  };

  const getEstadoInfo = (estado) => {
    return ESTADOS.find(e => e.value === estado) || { label: estado, color: 'bg-gray-100 text-gray-800' };
  };

  const formatFecha = (fechaStr) => {
    const fecha = new Date(fechaStr);
    return fecha.toLocaleString('es-PE', { 
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6">
      {mensaje.texto && (
        <div className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
          mensaje.tipo === 'success' 
            ? 'bg-green-50 border border-green-200 text-green-700' 
            : 'bg-red-50 border border-red-200 text-red-700'
        }`}>
          {mensaje.tipo === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{mensaje.texto}</span>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800">Pedidos de la Bodega (HU-13, HU-14)</h2>
        <button 
          onClick={cargarPedidos} 
          disabled={loading}
          className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Actualizar
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        </div>
      ) : pedidos.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <ShoppingBag size={48} className="mx-auto mb-4 text-gray-300" />
          <p>No hay pedidos registrados aún</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="p-3 font-medium text-gray-600">ID</th>
                <th className="p-3 font-medium text-gray-600">Cliente</th>
                <th className="p-3 font-medium text-gray-600">Teléfono</th>
                <th className="p-3 font-medium text-gray-600">Dirección</th>
                <th className="p-3 font-medium text-gray-600">Total</th>
                <th className="p-3 font-medium text-gray-600">Estado</th>
                <th className="p-3 font-medium text-gray-600">Fecha</th>
                <th className="p-3 font-medium text-gray-600">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {pedidos.map((pedido) => {
                const estadoInfo = getEstadoInfo(pedido.estado);
                const transiciones = getTransicionesValidas(pedido.estado);
                const esEstadoFinal = pedido.estado === 'ENTREGADO' || pedido.estado === 'CANCELADO';
                const puedeVerRepartidor = pedido.estado === 'EN_CAMINO' || pedido.estado === 'ENTREGADO';

                return (
                  <tr key={pedido.id} className="hover:bg-gray-50">
                    <td className="p-3 font-mono text-gray-800">#{pedido.id}</td>
                    <td className="p-3 text-gray-800">{pedido.nombre_cliente}</td>
                    <td className="p-3 text-gray-600">{pedido.telefono_cliente}</td>
                    <td className="p-3 text-gray-600 max-w-xs truncate">{pedido.direccion_entrega}</td>
                    <td className="p-3 font-semibold text-gray-800">S/. {parseFloat(pedido.total).toFixed(2)}</td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${estadoInfo.color}`}>
                        {estadoInfo.label}
                      </span>
                    </td>
                    <td className="p-3 text-gray-500">{formatFecha(pedido.created_at)}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        {!esEstadoFinal && (
                          <div className="relative">
                            <button className="text-gray-500 hover:text-gray-700 p-1">
                              <MoreVertical size={18} />
                            </button>
                            <div className="absolute right-0 top-full mt-1 bg-white border rounded-lg shadow-lg py-1 min-w-[140px] z-10">
                              {transiciones.map(est => (
                                <button
                                  key={est}
                                  onClick={() => handleCambiarEstado(pedido.id, est)}
                                  className="w-full px-3 py-2 text-left text-xs hover:bg-gray-100"
                                >
                                  {ESTADOS.find(e => e.value === est)?.label}
                                </button>
                              ))}
                              {puedeVerRepartidor && (
                                <button
                                  onClick={() => abrirModalRepartidor(pedido)}
                                  className="w-full px-3 py-2 text-left text-xs hover:bg-gray-100 flex items-center gap-2 text-purple-600"
                                >
                                  <MapPinIcon size={14} /> Ubicar repartidor
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                        {esEstadoFinal && (
                          <span className="text-xs text-gray-400">Finalizado</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal para ubicar repartidor */}
      {modalRepartidor && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-hidden">
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="font-semibold text-gray-800">Ubicar Repartidor - Pedido #{modalRepartidor.id}</h3>
              <button onClick={cerrarModalRepartidor} className="text-gray-500 hover:text-gray-700">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-4">
              <p className="text-sm text-gray-600 mb-4">Haz clic en el mapa para marcar la posición actual del repartidor:</p>
              <div className="h-64 w-full rounded-lg overflow-hidden border">
                <MapContainer center={[repartidorPos.lat, repartidorPos.lng]} zoom={15} className="h-full w-full">
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <Marker position={[repartidorPos.lat, repartidorPos.lng]}>
                    <div className="bg-purple-600 text-white p-2 rounded-full shadow-lg animate-bounce">
                      🛵
                    </div>
                  </Marker>
                </MapContainer>
              </div>
              <div className="mt-3 text-xs text-gray-500">
                Lat: {repartidorPos.lat.toFixed(6)}, Lng: {repartidorPos.lng.toFixed(6)}
              </div>
            </div>
            <div className="p-4 border-t flex justify-end gap-2">
              <button onClick={cerrarModalRepartidor} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancelar</button>
              <button 
                onClick={guardarRepartidor} 
                disabled={guardandoRepartidor}
                className="px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                {guardandoRepartidor ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Guardar ubicación'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}