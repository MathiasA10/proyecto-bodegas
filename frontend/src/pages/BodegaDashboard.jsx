import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import api from '../api/client';
import '../utils/fixLeafletIcon';
import { MapPin, Plus, Package, LogOut, CheckCircle2, AlertCircle } from 'lucide-react';

const LIMA_COORDS = [-12.046374, -77.042793];

function LocationSelector({ position, setPosition }) {
  useMapEvents({
    click(e) {
      setPosition([e.latlng.lat, e.latlng.lng]);
    },
  });
  return position ? <Marker position={position} /> : null;
}

export default function BodegaDashboard() {
  const [position, setPosition] = useState(LIMA_COORDS);
  const [nombreComercial, setNombreComercial] = useState('');
  const [direccion, setDireccion] = useState('');
  const [telefono, setTelefono] = useState('');
  const [tieneBodega, setTieneBodega] = useState(false);

  const [productos, setProductos] = useState([]);
  const [nuevoProd, setNuevoProd] = useState({ nombre: '', precio: '', stock: '' });
  const [mensaje, setMensaje] = useState({ tipo: '', texto: '' });

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    try {
      const resBodega = await api.get('bodega/mi-bodega/');
      if (resBodega.data && resBodega.data.nombre_comercial) {
        const b = resBodega.data;
        setTieneBodega(true);
        setNombreComercial(b.nombre_comercial || '');
        setDireccion(b.direccion || '');
        setTelefono(b.telefono || '');
        if (b.latitud && b.longitud) {
          setPosition([parseFloat(b.latitud), parseFloat(b.longitud)]);
        }
      }
    } catch (err) {
      console.log('Sin bodega registrada aún');
    }

    try {
      const resProd = await api.get('bodega/productos/');
      if (Array.isArray(resProd.data)) {
        setProductos(resProd.data);
      }
    } catch (err) {
      console.log('Error al consultar productos:', err);
    }
  };

  const handleGuardarBodega = async (e) => {
    e.preventDefault();
    setMensaje({ tipo: '', texto: '' });
    try {
      const data = {
        nombre_comercial: nombreComercial.trim(),
        direccion: direccion.trim(),
        telefono: telefono.trim(),
        latitud: parseFloat(position[0].toFixed(6)),
        longitud: parseFloat(position[1].toFixed(6))
      };
      await api.post('bodega/mi-bodega/', data);
      setTieneBodega(true);
      setMensaje({ tipo: 'success', texto: '¡Bodega y ubicación guardadas con éxito!' });
      cargarDatos();
    } catch (err) {
      console.error('Error al guardar bodega:', err.response?.data);
      const errDetail = err.response?.data 
        ? Object.entries(err.response.data).map(([k, v]) => `${k}: ${v}`).join(' | ') 
        : 'Error de conexión con el backend';
      setMensaje({ tipo: 'error', texto: `Error: ${errDetail}` });
    }
  };

  const handleAgregarProducto = async (e) => {
    e.preventDefault();
    if (!tieneBodega) {
      alert('Primero debes guardar los datos y ubicación de tu bodega.');
      return;
    }
    try {
      const payload = {
        nombre: nuevoProd.nombre.trim(),
        precio: parseFloat(nuevoProd.precio),
        stock: parseInt(nuevoProd.stock, 10)
      };
      await api.post('bodega/productos/', payload);
      setNuevoProd({ nombre: '', precio: '', stock: '' });
      setMensaje({ tipo: 'success', texto: 'Producto agregado exitosamente al catálogo.' });
      cargarDatos();
    } catch (err) {
      alert('Error al agregar el producto. Verifica que los campos sean válidos.');
    }
  };

  const handleCerrarSesion = () => {
    localStorage.clear();
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="bg-white p-4 rounded-xl shadow-sm flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-gray-800">Panel de Bodega</h1>
            <p className="text-xs text-gray-500">Gestión de perfil comercial, ubicación y catálogo</p>
          </div>
          <button 
            onClick={handleCerrarSesion} 
            className="flex items-center gap-1 text-sm font-medium text-red-600 hover:text-red-700 transition"
          >
            <LogOut size={16} /> Cerrar Sesión
          </button>
        </header>

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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Ubicación y Datos de Bodega (HU-03) */}
          <div className="bg-white p-5 rounded-xl shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <MapPin className="text-blue-600" />
              <h2 className="text-md font-semibold text-gray-800">Ubicación de la Bodega (HU-03)</h2>
            </div>
            <p className="text-xs text-gray-500">Haz clic en el mapa para marcar las coordenadas exactas de tu tienda:</p>
            
            <div className="h-64 w-full rounded-lg overflow-hidden border border-gray-200">
              <MapContainer center={LIMA_COORDS} zoom={13} className="h-full w-full">
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <LocationSelector position={position} setPosition={setPosition} />
              </MapContainer>
            </div>

            <form onSubmit={handleGuardarBodega} className="space-y-3">
              <div>
                <label className="text-xs text-gray-600 font-medium">Nombre Comercial</label>
                <input 
                  placeholder="Bodega Don Pepe" value={nombreComercial} required
                  onChange={(e) => setNombreComercial(e.target.value)} 
                  className="w-full border p-2 rounded text-sm outline-none mt-1"
                />
              </div>

              <div>
                <label className="text-xs text-gray-600 font-medium">Dirección Física</label>
                <input 
                  placeholder="Av. Universitaria 1234, Lima" value={direccion} required
                  onChange={(e) => setDireccion(e.target.value)} 
                  className="w-full border p-2 rounded text-sm outline-none mt-1"
                />
              </div>

              <div>
                <label className="text-xs text-gray-600 font-medium">Teléfono / WhatsApp</label>
                <input 
                  placeholder="987654321" value={telefono}
                  onChange={(e) => setTelefono(e.target.value)} 
                  className="w-full border p-2 rounded text-sm outline-none mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs bg-gray-50 p-2 rounded border border-gray-200 text-gray-600">
                <div>Lat: {position[0].toFixed(6)}</div>
                <div>Lng: {position[1].toFixed(6)}</div>
              </div>

              <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-sm font-medium transition">
                {tieneBodega ? 'Actualizar Bodega' : 'Registrar Bodega'}
              </button>
            </form>
          </div>

          {/* Catálogo de Productos (HU-04) */}
          <div className="bg-white p-5 rounded-xl shadow-sm flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Package className="text-green-600" />
                <h2 className="text-md font-semibold text-gray-800">Catálogo de Productos (HU-04)</h2>
              </div>
              <p className="text-xs text-gray-500 mb-4">Agrega los productos disponibles en tu inventario:</p>

              <form onSubmit={handleAgregarProducto} className="grid grid-cols-3 gap-2 mb-4">
                <input 
                  placeholder="Nombre producto" value={nuevoProd.nombre} required
                  onChange={(e) => setNuevoProd({ ...nuevoProd, nombre: e.target.value })} 
                  className="border p-2 rounded text-sm col-span-1 outline-none"
                />
                <input 
                  placeholder="Precio (S/)" type="number" step="0.10" value={nuevoProd.precio} required
                  onChange={(e) => setNuevoProd({ ...nuevoProd, precio: e.target.value })} 
                  className="border p-2 rounded text-sm col-span-1 outline-none"
                />
                <input 
                  placeholder="Stock" type="number" value={nuevoProd.stock} required
                  onChange={(e) => setNuevoProd({ ...nuevoProd, stock: e.target.value })} 
                  className="border p-2 rounded text-sm col-span-1 outline-none"
                />
                <button 
                  type="submit" 
                  disabled={!tieneBodega}
                  className={`col-span-3 py-2 rounded-lg text-sm font-medium flex justify-center items-center gap-1 transition ${
                    tieneBodega 
                      ? 'bg-green-600 hover:bg-green-700 text-white cursor-pointer' 
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  <Plus size={16} /> {tieneBodega ? 'Agregar Producto' : 'Registra la bodega primero'}
                </button>
              </form>

              <div className="overflow-y-auto max-h-72 border rounded-lg">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="p-2.5">Producto</th>
                      <th className="p-2.5">Precio</th>
                      <th className="p-2.5">Stock</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productos.length === 0 ? (
                      <tr>
                        <td colSpan="3" className="p-4 text-center text-gray-400">
                          Aún no has registrado productos.
                        </td>
                      </tr>
                    ) : (
                      productos.map((p) => (
                        <tr key={p.id} className="border-b hover:bg-gray-50">
                          <td className="p-2.5 font-medium text-gray-800">{p.nombre}</td>
                          <td className="p-2.5 text-gray-600">S/. {parseFloat(p.precio).toFixed(2)}</td>
                          <td className="p-2.5 text-gray-600">{p.stock} u.</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}