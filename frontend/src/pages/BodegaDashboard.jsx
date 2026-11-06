import { useCallback, useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import { Navigate, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  BarChart2,
  Edit2,
  LogOut,
  MapPin,
  Package,
  Plus,
  Settings,
  ShoppingBag,
  Store,
  Tag,
  Trash2,
} from 'lucide-react';

import api, { mediaUrl } from '../api/client';
import CatalogoProductos from '../components/CatalogoProductos';
import ConfirmDialog from '../components/ConfirmDialog';
import ProductoModal from '../components/ProductoModal';
import Toast from '../components/Toast';
import { useAuth } from '../hooks/useAuth';
import '../utils/fixLeafletIcon';

const LIMA_COORDS = [-12.046374, -77.042793];

function LocationSelector({ position, setPosition }) {
  useMapEvents({
    click(e) {
      setPosition([e.latlng.lat, e.latlng.lng]);
    },
  });
  return position ? <Marker position={position} /> : null;
}

const tabs = [
  { id: 'perfil', label: 'Perfil y Productos', icon: Settings, path: '' },
  { id: 'tienda', label: 'Mi tienda', icon: Store, path: 'tienda' },
  { id: 'pedidos', label: 'Pedidos', icon: ShoppingBag, path: 'pedidos' },
  { id: 'reportes', label: 'Reportes', icon: BarChart2, path: 'reportes' },
];

export default function BodegaDashboard() {
  const [tieneBodega, setTieneBodega] = useState(false);
  const [verificando, setVerificando] = useState(true);
  const { cerrarSesion } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const getActiveTab = () => {
    const path = location.pathname;
    if (path.endsWith('/tienda')) return 'tienda';
    if (path.endsWith('/pedidos')) return 'pedidos';
    if (path.endsWith('/reportes')) return 'reportes';
    return 'perfil';
  };

  const activeTab = getActiveTab();

  const verificarBodega = async () => {
    try {
      const res = await api.get('bodega/mi-bodega/');
      setTieneBodega(!!(res.data && res.data.nombre_comercial));
    } catch {
      setTieneBodega(false);
    } finally {
      setVerificando(false);
    }
  };

  useEffect(() => {
    verificarBodega();
  }, []);

  const handleCerrarSesion = async () => {
    await cerrarSesion();
    navigate('/');
  };

  if (verificando) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
      </div>
    );
  }

  if (!tieneBodega && activeTab !== 'perfil') {
    return <Navigate to="/bodega/dashboard" replace />;
  }

  const handleTabClick = (tabPath) => {
    const newPath = tabPath ? `/bodega/dashboard/${tabPath}` : '/bodega/dashboard';
    navigate(newPath);
  };

  return (
    <div className="min-h-screen bg-cream-50">
      <header className="border-b border-brand-100 bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white">
              <Store size={20} />
            </span>
            <div>
              <h1 className="text-lg font-extrabold text-slate-900">Panel de Bodega</h1>
              <p className="text-xs text-slate-500">Gestión de tu negocio</p>
            </div>
          </div>
          <button
            onClick={handleCerrarSesion}
            className="flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            <LogOut size={14} /> Cerrar Sesión
          </button>
        </div>

        <nav className="border-t border-slate-100 px-4" aria-label="Tabs principales">
          <ul className="flex gap-1 overflow-x-auto pb-2" role="tablist">
            {tabs.map(tab => (
              <li key={tab.id} role="presentation">
                <button
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  aria-controls={`panel-${tab.id}`}
                  id={`tab-${tab.id}`}
                  onClick={() => handleTabClick(tab.path)}
                  className={`flex items-center gap-2 whitespace-nowrap rounded-t-lg px-4 py-2.5 text-sm font-semibold transition ${
                    activeTab === tab.id
                      ? 'border-b-2 border-brand-600 bg-brand-50 text-brand-800'
                      : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                  }`}
                >
                  <tab.icon size={16} /> {tab.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6" role="tabpanel" id={`panel-${activeTab}`}>
        <Outlet />
      </main>
    </div>
  );
}

function useCategorias() {
  const [categorias, setCategorias] = useState([]);

  const cargarCategorias = useCallback(async () => {
    try {
      const res = await api.get('bodega/categorias/');
      setCategorias(Array.isArray(res.data) ? res.data : []);
    } catch {
      setCategorias([]);
    }
  }, []);

  return { categorias, setCategorias, cargarCategorias };
}

export function PerfilProductosTab() {
  const [position, setPosition] = useState(LIMA_COORDS);
  const [nombreComercial, setNombreComercial] = useState('');
  const [direccion, setDireccion] = useState('');
  const [telefono, setTelefono] = useState('');
  const [radioEntrega, setRadioEntrega] = useState('3');
  const [abierto, setAbierto] = useState(true);
  const [tieneBodega, setTieneBodega] = useState(false);

  const [productos, setProductos] = useState([]);
  const { categorias, setCategorias, cargarCategorias } = useCategorias();
  const [mensaje, setMensaje] = useState({ tipo: '', texto: '' });
  const [modalProducto, setModalProducto] = useState({ abierto: false, producto: null });
  const [productoAEliminar, setProductoAEliminar] = useState(null);

  const cargarDatos = useCallback(async () => {
    try {
      const resBodega = await api.get('bodega/mi-bodega/');
      if (resBodega.data && resBodega.data.nombre_comercial) {
        const b = resBodega.data;
        setTieneBodega(true);
        setNombreComercial(b.nombre_comercial || '');
        setDireccion(b.direccion || '');
        setTelefono(b.telefono || '');
        setRadioEntrega(String(b.radio_entrega_km ?? '3'));
        setAbierto(Boolean(b.abierto));
        if (b.latitud && b.longitud) {
          setPosition([parseFloat(b.latitud), parseFloat(b.longitud)]);
        }
      }
    } catch {
      setTieneBodega(false);
    }

    try {
      const resProd = await api.get('bodega/productos/');
      setProductos(Array.isArray(resProd.data) ? resProd.data : []);
    } catch {
      setProductos([]);
    }

    await cargarCategorias();
  }, [cargarCategorias]);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  const handleGuardarBodega = async (e) => {
    e.preventDefault();
    setMensaje({ tipo: '', texto: '' });
    try {
      const data = {
        nombre_comercial: nombreComercial.trim(),
        direccion: direccion.trim(),
        telefono: telefono.trim(),
        radio_entrega_km: parseFloat(radioEntrega),
        abierto,
        latitud: parseFloat(position[0].toFixed(6)),
        longitud: parseFloat(position[1].toFixed(6))
      };
      await api.post('bodega/mi-bodega/', data);
      setTieneBodega(true);
      setMensaje({ tipo: 'success', texto: 'Bodega y ubicación guardadas con éxito.' });
      cargarDatos();
    } catch (err) {
      const detalle = err.response?.data
        ? Object.entries(err.response.data).map(([k, v]) => `${k}: ${v}`).join(' | ')
        : 'Error de conexión con el backend';
      setMensaje({ tipo: 'error', texto: `Error: ${detalle}` });
    }
  };

  const handleEliminarProducto = async () => {
    if (!productoAEliminar) return;
    try {
      await api.delete(`bodega/productos/${productoAEliminar.id}/`);
      setMensaje({ tipo: 'success', texto: 'Producto eliminado.' });
      setProductoAEliminar(null);
      cargarDatos();
    } catch {
      setMensaje({ tipo: 'error', texto: 'No se pudo eliminar el producto.' });
    }
  };

  return (
    <div className="space-y-6">
      <Toast
        tipo={mensaje.tipo || 'success'}
        texto={mensaje.texto}
        onClose={() => setMensaje({ tipo: '', texto: '' })}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <MapPin className="text-brand-600" />
            <h2 className="text-base font-bold text-slate-900">Ubicación de la Bodega</h2>
          </div>
          <p className="text-xs text-slate-500">Haz clic en el mapa para marcar las coordenadas exactas de tu tienda.</p>

          <div className="h-64 w-full overflow-hidden rounded-xl border border-slate-200">
            <MapContainer center={LIMA_COORDS} zoom={13} className="h-full w-full">
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <LocationSelector position={position} setPosition={setPosition} />
            </MapContainer>
          </div>

          <form onSubmit={handleGuardarBodega} className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-slate-600">Nombre Comercial</label>
              <input
                placeholder="Bodega Don Pepe" value={nombreComercial} required
                onChange={(e) => setNombreComercial(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 p-2 text-sm outline-none transition focus:border-brand-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600">Dirección Física</label>
              <input
                placeholder="Av. Universitaria 1234, Lima" value={direccion} required
                onChange={(e) => setDireccion(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 p-2 text-sm outline-none transition focus:border-brand-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600">Teléfono / WhatsApp</label>
              <input
                placeholder="987654321" value={telefono}
                onChange={(e) => setTelefono(e.target.value.replace(/\D/g, '').slice(0, 9))}
                inputMode="numeric"
                maxLength={9}
                className="mt-1 w-full rounded-xl border border-slate-200 p-2 text-sm outline-none transition focus:border-brand-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-semibold text-slate-600">Radio de entrega (km)</label>
                <input
                  type="number" min="0.5" max="50" step="0.5" required
                  value={radioEntrega}
                  onChange={(e) => setRadioEntrega(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2 text-sm outline-none transition focus:border-brand-500"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Estado de atención</label>
                <button
                  type="button"
                  onClick={() => setAbierto((actual) => !actual)}
                  className={`mt-1 w-full rounded-xl border p-2 text-sm font-semibold transition ${
                    abierto
                      ? 'border-brand-300 bg-brand-50 text-brand-800'
                      : 'border-red-300 bg-red-50 text-red-700'
                  }`}
                >
                  {abierto ? 'Abierta · recibir pedidos' : 'Cerrada · sin pedidos'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2 text-xs text-slate-600">
              <div>Lat: {position[0].toFixed(6)}</div>
              <div>Lng: {position[1].toFixed(6)}</div>
            </div>

            <button type="submit" className="w-full rounded-xl bg-brand-600 py-2 text-sm font-semibold text-white transition hover:bg-brand-700">
              {tieneBodega ? 'Actualizar Bodega' : 'Registrar Bodega'}
            </button>
          </form>
        </div>

        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Package className="text-brand-600" />
              <h2 className="text-base font-bold text-slate-900">Catálogo de Productos</h2>
            </div>
            <button
              type="button"
              onClick={() => setModalProducto({ abierto: true, producto: null })}
              disabled={!tieneBodega}
              className="flex items-center gap-1 rounded-xl bg-brand-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              <Plus size={14} /> Agregar
            </button>
          </div>
          <p className="text-xs text-slate-500">
            Edita nombre, precio, stock, categoría e imagen de tus productos.
          </p>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="border-b bg-slate-50">
                <tr>
                  <th className="p-2.5">Producto</th>
                  <th className="p-2.5">Categoría</th>
                  <th className="p-2.5">Precio</th>
                  <th className="p-2.5">Stock</th>
                  <th className="p-2.5 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {productos.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="p-4 text-center text-slate-400">
                      Aún no has registrado productos.
                    </td>
                  </tr>
                ) : (
                  productos.map((producto) => {
                    const imagen = mediaUrl(producto.imagen);
                    return (
                      <tr key={producto.id} className="border-b last:border-0 hover:bg-slate-50">
                        <td className="p-2.5">
                          <div className="flex items-center gap-2">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-brand-50">
                              {imagen ? (
                                <img src={imagen} alt={producto.nombre} className="h-full w-full object-cover" />
                              ) : (
                                <Package size={14} className="text-brand-300" />
                              )}
                            </span>
                            <span className="font-medium text-slate-800">{producto.nombre}</span>
                          </div>
                        </td>
                        <td className="p-2.5 text-slate-600">
                          {producto.categoria_nombre || 'Otros'}
                        </td>
                        <td className="p-2.5 text-slate-600">S/. {parseFloat(producto.precio).toFixed(2)}</td>
                        <td className="p-2.5 text-slate-600">{producto.stock} u.</td>
                        <td className="p-2.5 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => setModalProducto({ abierto: true, producto })}
                              className="p-1 text-brand-600 hover:text-brand-800"
                              title="Editar"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setProductoAEliminar(producto)}
                              className="p-1 text-red-600 hover:text-red-800"
                              title="Eliminar"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <ProductoModal
        abierto={modalProducto.abierto}
        producto={modalProducto.producto}
        categorias={categorias}
        onClose={() => setModalProducto({ abierto: false, producto: null })}
        onCategoriaCreada={(categoria) => setCategorias((actual) => [...actual, categoria])}
        onGuardado={(texto) => {
          setModalProducto({ abierto: false, producto: null });
          setMensaje({ tipo: 'success', texto });
          cargarDatos();
        }}
      />

      <ConfirmDialog
        abierto={Boolean(productoAEliminar)}
        titulo="Eliminar producto"
        mensaje={`¿Seguro que deseas eliminar "${productoAEliminar?.nombre || ''}"?`}
        confirmarTexto="Eliminar"
        onConfirmar={handleEliminarProducto}
        onCancelar={() => setProductoAEliminar(null)}
      />
    </div>
  );
}

export function MiTiendaTab() {
  const [bodega, setBodega] = useState(null);
  const [productos, setProductos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const { categorias, setCategorias, cargarCategorias } = useCategorias();
  const [mensaje, setMensaje] = useState({ tipo: '', texto: '' });
  const [modalProducto, setModalProducto] = useState({ abierto: false, producto: null });
  const [productoAEliminar, setProductoAEliminar] = useState(null);
  const [categoriaAEliminar, setCategoriaAEliminar] = useState(null);
  const [nuevaCategoria, setNuevaCategoria] = useState('');
  const [creandoCategoria, setCreandoCategoria] = useState(false);

  const cargarDatos = useCallback(async () => {
    setCargando(true);
    try {
      const [resBodega, resProductos] = await Promise.all([
        api.get('bodega/mi-bodega/'),
        api.get('bodega/productos/'),
      ]);
      setBodega(resBodega.data);
      setProductos(Array.isArray(resProductos.data) ? resProductos.data : []);
      await cargarCategorias();
    } catch {
      setMensaje({ tipo: 'error', texto: 'No se pudo cargar tu tienda.' });
    } finally {
      setCargando(false);
    }
  }, [cargarCategorias]);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  const crearCategoria = async (evento) => {
    evento.preventDefault();
    const nombre = nuevaCategoria.trim();
    if (!nombre) return;
    setCreandoCategoria(true);
    try {
      const res = await api.post('bodega/categorias/', {
        nombre,
        orden: categorias.length,
      });
      setCategorias((actual) => [...actual, res.data]);
      setNuevaCategoria('');
      setMensaje({ tipo: 'success', texto: 'Categoría creada.' });
    } catch (err) {
      const detalle = err.response?.data
        ? Object.entries(err.response.data).map(([k, v]) => `${k}: ${v}`).join(' | ')
        : 'No se pudo crear la categoría.';
      setMensaje({ tipo: 'error', texto: detalle });
    } finally {
      setCreandoCategoria(false);
    }
  };

  const eliminarCategoria = async () => {
    if (!categoriaAEliminar) return;
    try {
      await api.delete(`bodega/categorias/${categoriaAEliminar.id}/`);
      setCategorias((actual) => actual.filter((c) => c.id !== categoriaAEliminar.id));
      setCategoriaAEliminar(null);
      setMensaje({ tipo: 'success', texto: 'Categoría eliminada.' });
    } catch (err) {
      setMensaje({
        tipo: 'error',
        texto:
          err.response?.data?.detail ||
          'No puedes eliminar una categoría que tiene productos.',
      });
      setCategoriaAEliminar(null);
    }
  };

  const eliminarProducto = async () => {
    if (!productoAEliminar) return;
    try {
      await api.delete(`bodega/productos/${productoAEliminar.id}/`);
      setProductoAEliminar(null);
      setMensaje({ tipo: 'success', texto: 'Producto eliminado.' });
      cargarDatos();
    } catch {
      setMensaje({ tipo: 'error', texto: 'No se pudo eliminar el producto.' });
    }
  };

  if (cargando) {
    return (
      <div className="flex justify-center py-16">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Toast
        tipo={mensaje.tipo || 'success'}
        texto={mensaje.texto}
        onClose={() => setMensaje({ tipo: '', texto: '' })}
      />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand-100 bg-white p-5 shadow-sm">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-brand-700">
            Vista previa de tu tienda
          </p>
          <h2 className="text-xl font-extrabold text-slate-900">
            {bodega?.nombre_comercial || 'Mi tienda'}
          </h2>
          <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
            <MapPin size={12} /> {bodega?.direccion}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
            bodega?.abierto ? 'bg-brand-100 text-brand-800' : 'bg-red-100 text-red-700'
          }`}>
            {bodega?.abierto ? 'Abierta' : 'Cerrada'}
          </span>
          <button
            type="button"
            onClick={() => setModalProducto({ abierto: true, producto: null })}
            className="flex items-center gap-1 rounded-xl bg-brand-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-brand-700"
          >
            <Plus size={14} /> Agregar producto
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <Tag size={16} className="text-brand-600" />
          <h3 className="text-sm font-bold text-slate-900">Categorías</h3>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {categorias.map((categoria) => (
            <span
              key={categoria.id}
              className="flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600"
            >
              {categoria.nombre}
              <button
                type="button"
                onClick={() => setCategoriaAEliminar(categoria)}
                className="text-slate-400 transition hover:text-red-600"
                aria-label={`Eliminar ${categoria.nombre}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <form onSubmit={crearCategoria} className="mt-3 flex gap-2">
          <input
            value={nuevaCategoria}
            onChange={(e) => setNuevaCategoria(e.target.value)}
            placeholder="Nueva categoría"
            className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none transition focus:border-brand-500"
          />
          <button
            type="submit"
            disabled={creandoCategoria}
            className="rounded-xl bg-brand-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
          >
            {creandoCategoria ? 'Creando...' : 'Crear'}
          </button>
        </form>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <CatalogoProductos
          productos={productos}
          categorias={categorias}
          abierto={Boolean(bodega?.abierto)}
          modoEdicion
          onEditar={(producto) => setModalProducto({ abierto: true, producto })}
          onEliminar={setProductoAEliminar}
          textoVacio="Aún no tienes productos. Agrega el primero."
        />
      </div>

      <ProductoModal
        abierto={modalProducto.abierto}
        producto={modalProducto.producto}
        categorias={categorias}
        onClose={() => setModalProducto({ abierto: false, producto: null })}
        onCategoriaCreada={(categoria) => setCategorias((actual) => [...actual, categoria])}
        onGuardado={(texto) => {
          setModalProducto({ abierto: false, producto: null });
          setMensaje({ tipo: 'success', texto });
          cargarDatos();
        }}
      />

      <ConfirmDialog
        abierto={Boolean(productoAEliminar)}
        titulo="Eliminar producto"
        mensaje={`¿Seguro que deseas eliminar "${productoAEliminar?.nombre || ''}"?`}
        confirmarTexto="Eliminar"
        onConfirmar={eliminarProducto}
        onCancelar={() => setProductoAEliminar(null)}
      />

      <ConfirmDialog
        abierto={Boolean(categoriaAEliminar)}
        titulo="Eliminar categoría"
        mensaje={`¿Eliminar la categoría "${categoriaAEliminar?.nombre || ''}"? Solo es posible si no tiene productos.`}
        confirmarTexto="Eliminar"
        onConfirmar={eliminarCategoria}
        onCancelar={() => setCategoriaAEliminar(null)}
      />
    </div>
  );
}
