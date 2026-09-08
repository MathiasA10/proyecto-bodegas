import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api/client';

export default function RegisterBodeguero() {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    first_name: '',
    last_name: '',
    dni: '',
    password: '',
    rol: 'BODEGUERO'
  });
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('auth/register/bodeguero/', formData);
      alert('¡Cuenta de bodeguero creada con éxito! Ahora inicia sesión.');
      navigate('/');
    } catch (err) {
      if (err.response?.data) {
        const errors = err.response.data;
        const msg = Object.entries(errors)
          .map(([key, val]) => `${key}: ${Array.isArray(val) ? val.join(' ') : val}`)
          .join(' | ');
        setError(msg);
      } else {
        setError('Error de comunicación con el backend (127.0.0.1:8000)');
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-6">
        <h2 className="text-xl font-bold text-gray-800 text-center mb-1">Registro de Bodeguero</h2>
        <p className="text-xs text-gray-500 text-center mb-6">Crea tu cuenta para vender en línea</p>

        {error && (
          <div className="p-3 mb-4 bg-red-100 border border-red-300 text-red-700 text-xs rounded-lg break-words">
            {error}
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-3">
          <div>
            <label className="text-xs text-gray-600 font-medium">Nombre de usuario</label>
            <input 
              name="username" required onChange={handleChange} 
              placeholder="bodega_central" className="w-full border p-2 rounded text-sm outline-none mt-1" 
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-600 font-medium">Nombres</label>
              <input 
                name="first_name" required onChange={handleChange} 
                placeholder="Mathias" className="w-full border p-2 rounded text-sm outline-none mt-1" 
              />
            </div>
            <div>
              <label className="text-xs text-gray-600 font-medium">Apellidos</label>
              <input 
                name="last_name" required onChange={handleChange} 
                placeholder="Aroni" className="w-full border p-2 rounded text-sm outline-none mt-1" 
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-600 font-medium">DNI (opcional)</label>
            <input 
              name="dni" maxLength="8" onChange={handleChange} 
              placeholder="72794425" className="w-full border p-2 rounded text-sm outline-none mt-1" 
            />
          </div>

          <div>
            <label className="text-xs text-gray-600 font-medium">Correo Electrónico</label>
            <input 
              name="email" type="email" required onChange={handleChange} 
              placeholder="correo@ejemplo.com" className="w-full border p-2 rounded text-sm outline-none mt-1" 
            />
          </div>

          <div>
            <label className="text-xs text-gray-600 font-medium">Contraseña</label>
            <input 
              name="password" type="password" required onChange={handleChange} 
              placeholder="••••••••" className="w-full border p-2 rounded text-sm outline-none mt-1" 
            />
          </div>

          <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-sm font-medium mt-3 transition">
            Crear Cuenta
          </button>
        </form>

        <p className="text-center text-xs text-gray-500 mt-4">
          ¿Ya tienes cuenta? <Link to="/" className="text-blue-600 hover:underline">Inicia sesión</Link>
        </p>
      </div>
    </div>
  );
}