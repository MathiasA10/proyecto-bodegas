import { useEffect, useState } from 'react';
import { ImagePlus, Loader2, Plus, X } from 'lucide-react';

import api, { mediaUrl } from '../api/client';

function extraerError(error) {
  const data = error.response?.data;
  if (!data) return 'No se pudo guardar el producto.';
  if (typeof data === 'string') return data;
  return Object.entries(data)
    .map(([campo, valor]) => {
      const detalle = Array.isArray(valor) ? valor.join(' ') : valor;
      return `${campo}: ${detalle}`;
    })
    .join(' | ');
}

export default function ProductoModal({
  abierto,
  producto,
  categorias,
  onClose,
  onGuardado,
  onCategoriaCreada,
}) {
  const [form, setForm] = useState({
    nombre: '',
    descripcion: '',
    precio: '',
    stock: '',
    categoria: '',
  });
  const [archivo, setArchivo] = useState(null);
  const [preview, setPreview] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [nuevaCategoria, setNuevaCategoria] = useState('');
  const [mostrandoNueva, setMostrandoNueva] = useState(false);
  const [creandoCategoria, setCreandoCategoria] = useState(false);

  useEffect(() => {
    if (!abierto) return;
    setForm({
      nombre: producto?.nombre || '',
      descripcion: producto?.descripcion || '',
      precio: producto?.precio != null ? String(producto.precio) : '',
      stock: producto?.stock != null ? String(producto.stock) : '',
      categoria:
        producto?.categoria != null
          ? String(producto.categoria)
          : categorias[0]
            ? String(categorias[0].id)
            : '',
    });
    setArchivo(null);
    setPreview(null);
    setError('');
    setNuevaCategoria('');
    setMostrandoNueva(categorias.length === 0);
  }, [abierto, producto, categorias]);

  useEffect(() => {
    if (!preview) return undefined;
    return () => URL.revokeObjectURL(preview);
  }, [preview]);

  if (!abierto) return null;

  const cambiar = (evento) => {
    const { name, value } = evento.target;
    setForm((actual) => ({ ...actual, [name]: value }));
  };

  const seleccionarImagen = (evento) => {
    const file = evento.target.files?.[0] || null;
    setArchivo(file);
    setPreview(file ? URL.createObjectURL(file) : null);
  };

  const crearCategoria = async () => {
    const nombre = nuevaCategoria.trim();
    if (!nombre) return;
    setCreandoCategoria(true);
    setError('');
    try {
      const res = await api.post('bodega/categorias/', {
        nombre,
        orden: categorias.length,
      });
      onCategoriaCreada?.(res.data);
      setForm((actual) => ({ ...actual, categoria: String(res.data.id) }));
      setNuevaCategoria('');
      setMostrandoNueva(false);
    } catch (err) {
      setError(extraerError(err));
    } finally {
      setCreandoCategoria(false);
    }
  };

  const guardar = async (evento) => {
    evento.preventDefault();
    setError('');

    if (!form.nombre.trim()) {
      setError('Ingresa el nombre del producto.');
      return;
    }
    if (!form.categoria) {
      setError('Selecciona o crea una categoría.');
      return;
    }

    setGuardando(true);
    try {
      const datos = new FormData();
      datos.append('nombre', form.nombre.trim());
      datos.append('descripcion', form.descripcion.trim());
      datos.append('precio', form.precio);
      datos.append('stock', form.stock);
      datos.append('categoria', form.categoria);
      if (archivo) datos.append('imagen_file', archivo);

      if (producto) {
        await api.patch(`bodega/productos/${producto.id}/`, datos);
      } else {
        await api.post('bodega/productos/', datos);
      }

      onGuardado?.(
        producto ? 'Producto actualizado.' : 'Producto agregado al catálogo.'
      );
    } catch (err) {
      setError(extraerError(err));
    } finally {
      setGuardando(false);
    }
  };

  const imagenActual = preview || mediaUrl(producto?.imagen);

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/50 p-4">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-base font-bold text-slate-900">
            {producto ? 'Editar producto' : 'Agregar producto'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={guardar} className="space-y-3 p-5">
          <div>
            <label className="text-xs font-semibold text-slate-600">Nombre</label>
            <input
              name="nombre"
              value={form.nombre}
              onChange={cambiar}
              required
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-brand-500"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600">
              Descripción
            </label>
            <textarea
              name="descripcion"
              value={form.descripcion}
              onChange={cambiar}
              rows={2}
              className="mt-1 w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-brand-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-600">
                Precio (S/)
              </label>
              <input
                name="precio"
                type="number"
                min="0.01"
                step="0.01"
                value={form.precio}
                onChange={cambiar}
                required
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-brand-500"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">Stock</label>
              <input
                name="stock"
                type="number"
                min="0"
                step="1"
                value={form.stock}
                onChange={cambiar}
                required
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-brand-500"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-600">
                Categoría
              </label>
              <button
                type="button"
                onClick={() => setMostrandoNueva((actual) => !actual)}
                className="flex items-center gap-1 text-[11px] font-semibold text-brand-700 hover:text-brand-800"
              >
                <Plus size={12} /> Nueva categoría
              </button>
            </div>
            <select
              name="categoria"
              value={form.categoria}
              onChange={cambiar}
              required
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-brand-500"
            >
              <option value="">Selecciona una categoría</option>
              {categorias.map((categoria) => (
                <option key={categoria.id} value={categoria.id}>
                  {categoria.nombre}
                </option>
              ))}
            </select>

            {mostrandoNueva && (
              <div className="mt-2 flex gap-2">
                <input
                  value={nuevaCategoria}
                  onChange={(e) => setNuevaCategoria(e.target.value)}
                  placeholder="Ej. Frutas y verduras"
                  className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none transition focus:border-brand-500"
                />
                <button
                  type="button"
                  onClick={crearCategoria}
                  disabled={creandoCategoria}
                  className="rounded-xl bg-brand-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
                >
                  {creandoCategoria ? 'Creando...' : 'Crear'}
                </button>
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600">Imagen</label>
            <div className="mt-1 flex items-center gap-3">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-dashed border-slate-300 bg-slate-50">
                {imagenActual ? (
                  <img
                    src={imagenActual}
                    alt="Vista previa"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <ImagePlus size={22} className="text-slate-400" />
                )}
              </div>
              <label className="cursor-pointer rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50">
                Elegir imagen
                <input
                  type="file"
                  accept="image/*"
                  onChange={seleccionarImagen}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {error && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando}
              className="flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
            >
              {guardando && <Loader2 size={14} className="animate-spin" />}
              {guardando ? 'Guardando...' : 'Guardar producto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
