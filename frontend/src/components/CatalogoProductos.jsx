import { useMemo, useState } from 'react';
import { Edit2, Package, Plus, Search, Trash2 } from 'lucide-react';

import { mediaUrl } from '../api/client';

function formatoPrecio(valor) {
  return Number(valor || 0).toFixed(2);
}

export default function CatalogoProductos({
  productos = [],
  categorias = [],
  abierto = true,
  modoEdicion = false,
  onAgregar,
  onEditar,
  onEliminar,
  textoVacio = 'No hay productos que coincidan con tu búsqueda.',
}) {
  const [busqueda, setBusqueda] = useState('');
  const [categoriaActiva, setCategoriaActiva] = useState('TODOS');

  const categoriasDisponibles = useMemo(() => {
    const conteo = new Map();
    productos.forEach((producto) => {
      conteo.set(producto.categoria, (conteo.get(producto.categoria) || 0) + 1);
    });

    return categorias
      .filter((categoria) => conteo.has(categoria.id))
      .map((categoria) => ({
        ...categoria,
        cantidad: conteo.get(categoria.id),
      }));
  }, [productos, categorias]);

  const productosFiltrados = useMemo(() => {
    const q = busqueda.toLowerCase().trim();

    return productos.filter((producto) => {
      const coincideCategoria =
        categoriaActiva === 'TODOS' || producto.categoria === categoriaActiva;
      const coincideTexto =
        !q || producto.nombre.toLowerCase().includes(q);
      return coincideCategoria && coincideTexto;
    });
  }, [productos, busqueda, categoriaActiva]);

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            size={16}
          />
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar producto..."
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-brand-500"
          />
        </div>
        <span className="text-xs font-medium text-slate-500">
          {productosFiltrados.length} productos
        </span>
      </div>

      <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setCategoriaActiva('TODOS')}
          className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
            categoriaActiva === 'TODOS'
              ? 'bg-brand-600 text-white'
              : 'border border-slate-200 bg-white text-slate-600 hover:border-brand-300'
          }`}
        >
          Todos
        </button>
        {categoriasDisponibles.map((categoria) => (
          <button
            type="button"
            key={categoria.id}
            onClick={() => setCategoriaActiva(categoria.id)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
              categoriaActiva === categoria.id
                ? 'bg-brand-600 text-white'
                : 'border border-slate-200 bg-white text-slate-600 hover:border-brand-300'
            }`}
          >
            {categoria.nombre} · {categoria.cantidad}
          </button>
        ))}
      </div>

      {productosFiltrados.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
          <Package className="mx-auto mb-2 text-slate-300" size={34} />
          <p className="text-sm text-slate-500">{textoVacio}</p>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
          {productosFiltrados.map((producto) => {
            const imagen = mediaUrl(producto.imagen);
            const agotado = Number(producto.stock) <= 0;
            const nombreCategoria =
              producto.categoria_nombre ||
              categorias.find((categoria) => categoria.id === producto.categoria)?.nombre ||
              'Otros';

            return (
              <article
                key={producto.id}
                className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="relative flex h-28 items-center justify-center bg-brand-50">
                  {imagen ? (
                    <img
                      src={imagen}
                      alt={producto.nombre}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Package className="text-brand-300" size={34} />
                  )}
                  <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                    {nombreCategoria}
                  </span>
                  {modoEdicion && (
                    <div className="absolute right-2 top-2 flex gap-1">
                      <button
                        type="button"
                        onClick={() => onEditar?.(producto)}
                        className="rounded-lg bg-white/95 p-1.5 text-brand-700 shadow transition hover:bg-white"
                        title="Editar producto"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => onEliminar?.(producto)}
                        className="rounded-lg bg-white/95 p-1.5 text-red-600 shadow transition hover:bg-white"
                        title="Eliminar producto"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex flex-1 flex-col gap-1 p-3">
                  <h3 className="line-clamp-2 text-xs font-semibold text-slate-800">
                    {producto.nombre}
                  </h3>
                  <p className="text-[10px] text-slate-400">
                    Stock: {producto.stock}
                  </p>

                  <div className="mt-auto flex items-center justify-between gap-2 pt-2">
                    <span className="text-sm font-extrabold text-slate-900">
                      S/ {formatoPrecio(producto.precio)}
                    </span>
                    {modoEdicion ? (
                      <span className="text-[10px] font-semibold text-slate-400">
                        Modo edición
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onAgregar?.(producto)}
                        disabled={!abierto || agotado}
                        className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition ${
                          agotado || !abierto
                            ? 'cursor-not-allowed bg-slate-100 text-slate-400'
                            : 'bg-brand-600 text-white hover:bg-brand-700'
                        }`}
                      >
                        {agotado ? (
                          'Agotado'
                        ) : (
                          <>
                            <Plus size={13} /> Agregar
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
