import { useEffect, useState } from 'react';
import {
  BarChart2,
  DollarSign,
  Loader2,
  Package,
  RefreshCw,
  ShoppingBag,
  TrendingUp,
} from 'lucide-react';

import api from '../api/client';
import Toast from '../components/Toast';

export default function BodegaReportes() {
  const [reporte, setReporte] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mensaje, setMensaje] = useState({ tipo: '', texto: '' });

  const cargarReporte = async () => {
    setLoading(true);
    try {
      const res = await api.get('bodega/reportes/ventas/');
      setReporte(res.data);
    } catch {
      setMensaje({ tipo: 'error', texto: 'Error al cargar el reporte de ventas.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarReporte();
  }, []);

  const formatNumber = (num) => new Intl.NumberFormat('es-PE').format(num);

  const formatCurrency = (num) =>
    new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(num);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
      </div>
    );
  }

  if (!reporte) {
    return (
      <div className="py-12 text-center text-slate-500">
        <BarChart2 size={48} className="mx-auto mb-4 text-slate-300" />
        <p className="text-sm">No se pudo cargar el reporte.</p>
        <button
          type="button"
          onClick={cargarReporte}
          className="mt-4 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
        >
          Reintentar
        </button>
      </div>
    );
  }

  const ticketPromedio =
    reporte.cantidad_pedidos_completados > 0
      ? (reporte.total_ventas || 0) / reporte.cantidad_pedidos_completados
      : 0;

  const tasaCompletacion =
    reporte.pedidos_totales_registrados > 0
      ? (reporte.cantidad_pedidos_completados / reporte.pedidos_totales_registrados) * 100
      : 0;

  const tarjetas = [
    {
      titulo: 'Total recaudado',
      valor: formatCurrency(reporte.total_ventas || 0),
      detalle: 'Solo órdenes entregadas',
      icono: DollarSign,
      clases: 'bg-brand-50 text-brand-700',
    },
    {
      titulo: 'Pedidos completados',
      valor: formatNumber(reporte.cantidad_pedidos_completados || 0),
      detalle: 'Órdenes en estado Entregado',
      icono: ShoppingBag,
      clases: 'bg-blue-50 text-blue-700',
    },
    {
      titulo: 'Pedidos registrados',
      valor: formatNumber(reporte.pedidos_totales_registrados || 0),
      detalle: 'Incluye todos los estados',
      icono: TrendingUp,
      clases: 'bg-accent-100 text-accent-600',
    },
  ];

  return (
    <div className="space-y-5">
      <Toast
        tipo={mensaje.tipo || 'success'}
        texto={mensaje.texto}
        onClose={() => setMensaje({ tipo: '', texto: '' })}
      />

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-extrabold text-slate-900">Reporte de ventas</h2>
        <button
          type="button"
          onClick={cargarReporte}
          disabled={loading}
          className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Actualizar
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {tarjetas.map(({ titulo, valor, detalle, icono: Icono, clases }) => (
          <div key={titulo} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${clases}`}>
                <Icono size={20} />
              </span>
              <div>
                <p className="text-xs font-medium text-slate-500">{titulo}</p>
                <p className="text-xl font-extrabold text-slate-900">{valor}</p>
              </div>
            </div>
            <p className="mt-2 text-[11px] text-slate-400">{detalle}</p>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 p-4">
          <Package size={18} className="text-brand-600" />
          <h3 className="text-sm font-bold text-slate-900">Top 5 productos más vendidos</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-white">
              <tr>
                <th className="p-3 font-semibold text-slate-500">#</th>
                <th className="p-3 font-semibold text-slate-500">Producto</th>
                <th className="p-3 text-right font-semibold text-slate-500">Unidades</th>
                <th className="p-3 text-right font-semibold text-slate-500">Total generado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(reporte.top_productos || []).length === 0 ? (
                <tr>
                  <td colSpan="4" className="p-6 text-center text-slate-400">
                    No hay productos vendidos aún.
                  </td>
                </tr>
              ) : (
                (reporte.top_productos || []).map((prod, index) => (
                  <tr key={prod.producto__nombre} className="hover:bg-slate-50">
                    <td className="p-3 font-medium text-slate-400">{index + 1}</td>
                    <td className="p-3 font-medium text-slate-800">{prod.producto__nombre}</td>
                    <td className="p-3 text-right text-slate-600">
                      {formatNumber(prod.unidades_vendidas || 0)}
                    </td>
                    <td className="p-3 text-right font-semibold text-slate-800">
                      {formatCurrency(prod.total_generado || 0)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-sm font-bold text-slate-900">Resumen del negocio</h3>
        <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs text-slate-500">Ticket promedio</p>
            <p className="mt-1 text-lg font-extrabold text-slate-900">
              {formatCurrency(ticketPromedio)}
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs text-slate-500">Tasa de completación</p>
            <p className="mt-1 text-lg font-extrabold text-slate-900">
              {tasaCompletacion.toFixed(1)}%
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
