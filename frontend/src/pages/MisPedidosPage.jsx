import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Clock,
  Loader2,
  LogOut,
  MapPin,
  Package,
  ShoppingBag,
  Store,
} from 'lucide-react';

import api from '../api/client';
import { cerrarSesion, getNombre } from '../utils/auth';

const ESTADOS = {
  PENDIENTE: { label: 'Pendiente', color: 'bg-accent-100 text-accent-600' },
  EN_PREPARACIÓN: { label: 'En preparación', color: 'bg-blue-100 text-blue-700' },
  EN_CAMINO: { label: 'En camino', color: 'bg-purple-100 text-purple-700' },
  LISTO_PARA_RECOGER: { label: 'Listo para recoger', color: 'bg-brand-100 text-brand-800' },
  ENTREGADO: { label: 'Entregado', color: 'bg-brand-100 text-brand-800' },
  CANCELADO: { label: 'Cancelado', color: 'bg-red-100 text-red-700' },
};

function formatoFecha(fecha) {
  return new Date(fecha).toLocaleString('es-PE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function MisPedidosPage() {
  const navigate = useNavigate();
  const [pedidos, setPedidos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let activo = true;
    api
      .get('cliente/pedidos/')
      .then((res) => {
        if (activo) setPedidos(res.data);
      })
      .catch(() => {
        if (activo) setError('No pudimos cargar tus pedidos.');
      })
      .finally(() => {
        if (activo) setCargando(false);
      });
    return () => {
      activo = false;
    };
  }, []);

  const salir = () => {
    cerrarSesion();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-cream-50">
      <header className="sticky top-0 z-10 border-b border-brand-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate('/mapa')}
              className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-brand-700"
            >
              <ArrowLeft size={18} />
            </button>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white">
              <ShoppingBag size={18} />
            </span>
            <div>
              <h1 className="text-sm font-extrabold text-slate-900">Mis pedidos</h1>
              <p className="text-[11px] text-slate-500">
                {getNombre() ? `Hola, ${getNombre()}` : 'Historial de compras'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={salir}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            <LogOut size={14} /> Cerrar sesión
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        {cargando ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
            {error}
          </div>
        ) : pedidos.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
            <Package className="mx-auto mb-3 text-slate-300" size={42} />
            <h2 className="text-base font-bold text-slate-800">
              Aún no tienes pedidos
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Explora las bodegas cercanas y realiza tu primera compra.
            </p>
            <button
              type="button"
              onClick={() => navigate('/mapa')}
              className="mt-5 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
            >
              Ver bodegas
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {pedidos.map((pedido) => {
              const estado = ESTADOS[pedido.estado] || {
                label: pedido.estado,
                color: 'bg-slate-100 text-slate-600',
              };
              return (
                <article
                  key={pedido.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                        <Store size={18} />
                      </span>
                      <div>
                        <h2 className="text-sm font-bold text-slate-900">
                          {pedido.bodega?.nombre || 'Bodega'}
                        </h2>
                        <p className="text-[11px] text-slate-500">
                          Pedido #{pedido.id} · {formatoFecha(pedido.created_at)}
                        </p>
                      </div>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${estado.color}`}>
                      {estado.label}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
                    <span className="flex items-center gap-1">
                      <MapPin size={12} />
                      {pedido.metodo_entrega === 'RECOJO'
                        ? 'Recojo en tienda'
                        : pedido.direccion_entrega}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock size={12} />
                      {pedido.metodo_pago === 'CONTRA_ENTREGA'
                        ? 'Contra entrega'
                        : pedido.metodo_pago}
                    </span>
                    <span className="flex items-center gap-1 font-semibold text-slate-700">
                      <Package size={12} />
                      {pedido.items?.length || 0} productos
                    </span>
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
                    <span className="text-base font-extrabold text-slate-900">
                      S/ {Number(pedido.total).toFixed(2)}
                    </span>
                    <button
                      type="button"
                      onClick={() => navigate(`/pedido/${pedido.id}/seguimiento`)}
                      className="rounded-xl bg-brand-600 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-brand-700"
                    >
                      Ver seguimiento
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
