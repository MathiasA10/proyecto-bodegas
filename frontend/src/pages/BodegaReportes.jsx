import { useState, useEffect } from 'react';
import api from '../api/client';
import { BarChart2, ShoppingBag, DollarSign, TrendingUp, Loader2, RefreshCw, Package } from 'lucide-react';

export default function BodegaReportes() {
  const [reporte, setReporte] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mensaje, setMensaje] = useState({ tipo: '', texto: '' });

  useEffect(() => {
    cargarReporte();
  }, []);

  const cargarReporte = async () => {
    setLoading(true);
    try {
      const res = await api.get('bodega/reportes/ventas/');
      setReporte(res.data);
    } catch (err) {
      console.error('Error al cargar reporte:', err);
      setMensaje({ tipo: 'error', texto: 'Error al cargar el reporte de ventas' });
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num) => {
    return new Intl.NumberFormat('es-PE').format(num);
  };

  const formatCurrency = (num) => {
    return new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(num);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (!reporte) {
    return (
      <div className="text-center py-12 text-gray-500">
        <BarChart2 size={48} className="mx-auto mb-4 text-gray-300" />
        <p>No se pudo cargar el reporte</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {mensaje.texto && (
        <div className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
          mensaje.tipo === 'success' 
            ? 'bg-green-50 border border-green-200 text-green-700' 
            : 'bg-red-50 border border-red-200 text-red-700'
        }`}>
          <span>{mensaje.texto}</span>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800">Reporte de Ventas (HU-16)</h2>
        <button 
          onClick={cargarReporte} 
          disabled={loading}
          className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Actualizar
        </button>
      </div>

      {/* Cards principales */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl shadow-sm border-l-4 border-blue-600">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 rounded-lg">
              <DollarSign className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">Total Recaudado</p>
              <p className="text-2xl font-bold text-gray-800">{formatCurrency(reporte.total_ventas || 0)}</p>
            </div>
          </div>
          <p className="mt-2 text-xs text-gray-500">Solo órdenes entregadas</p>
        </div>

        <div className="bg-white p-5 rounded-xl shadow-sm border-l-4 border-green-600">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-100 rounded-lg">
              <ShoppingBag className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">Pedidos Completados</p>
              <p className="text-2xl font-bold text-gray-800">{formatNumber(reporte.cantidad_pedidos_completados || 0)}</p>
            </div>
          </div>
          <p className="mt-2 text-xs text-gray-500">Órdenes en estado Entregado</p>
        </div>

        <div className="bg-white p-5 rounded-xl shadow-sm border-l-4 border-purple-600">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-100 rounded-lg">
              <TrendingUp className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">Total Pedidos Registrados</p>
              <p className="text-2xl font-bold text-gray-800">{formatNumber(reporte.pedidos_totales_registrados || 0)}</p>
            </div>
          </div>
          <p className="mt-2 text-xs text-gray-500">Incluye todos los estados</p>
        </div>
      </div>

      {/* Top Productos */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b bg-gray-50">
          <h3 className="text-md font-semibold text-gray-800 flex items-center gap-2">
            <Package className="w-5 h-5 text-purple-600" />
            Top 5 Productos Más Vendidos
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="p-3 text-left font-medium text-gray-600">#</th>
                <th className="p-3 text-left font-medium text-gray-600">Producto</th>
                <th className="p-3 text-right font-medium text-gray-600">Unidades Vendidas</th>
                <th className="p-3 text-right font-medium text-gray-600">Total Generado</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(reporte.top_productos || []).length === 0 ? (
                <tr>
                  <td colSpan="4" className="p-6 text-center text-gray-500">
                    No hay productos vendidos aún
                  </td>
                </tr>
              ) : (
                (reporte.top_productos || []).map((prod, index) => (
                  <tr key={prod.producto__nombre} className="hover:bg-gray-50">
                    <td className="p-3 text-gray-500 font-medium">{index + 1}</td>
                    <td className="p-3 font-medium text-gray-800">{prod.producto__nombre}</td>
                    <td className="p-3 text-right text-gray-600">{formatNumber(prod.unidades_vendidas || 0)}</td>
                    <td className="p-3 text-right font-semibold text-gray-800">
                      {formatCurrency(prod.total_generado || 0)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Resumen adicional */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-md font-semibold text-gray-800 mb-4">Resumen del Negocio</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-gray-500 mb-1">Ticket promedio</p>
            <p className="font-bold text-gray-800">
              {reporte.cantidad_pedidos_completados > 0 
                ? formatCurrency((reporte.total_ventas || 0) / reporte.cantidad_pedidos_completados)
                : 'S/. 0.00'}
            </p>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-gray-500 mb-1">Tasa de completación</p>
            <p className="font-bold text-gray-800">
              {reporte.pedidos_totales_registrados > 0
                ? `${((reporte.cantidad_pedidos_completados / reporte.pedidos_totales_registrados) * 100).toFixed(1)}%`
                : '0%'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}