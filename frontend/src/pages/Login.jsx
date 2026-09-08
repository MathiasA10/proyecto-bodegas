import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api/client';
import { Store, Lock, Mail } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await api.post('auth/login/', { email, password });
      localStorage.setItem('access_token', res.data.access);
      localStorage.setItem('refresh_token', res.data.refresh);
      localStorage.setItem('user_rol', res.data.rol);
      localStorage.setItem('user_nombre', res.data.nombre);

      if (res.data.rol === 'BODEGUERO') {
        navigate('/bodega/dashboard');
      } else {
        navigate('/mapa');
      }
    } catch (err) {
      setError('Correo o contraseña incorrectos');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8">
        <div className="flex flex-col items-center mb-6">
          <div className="p-3 bg-blue-100 rounded-full text-blue-600 mb-2">
            <Store size={32} />
          </div>
          <h2 className="text-2xl font-bold text-gray-800">Iniciar Sesión</h2>
          <p className="text-sm text-gray-500">Plataforma de Bodegas Lima</p>
        </div>

        {error && <div className="p-3 mb-4 bg-red-100 text-red-700 text-sm rounded-lg">{error}</div>}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-600">Correo Electrónico</label>
            <div className="flex items-center border rounded-lg px-3 py-2 mt-1">
              <Mail size={18} className="text-gray-400 mr-2" />
              <input 
                type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="ejemplo@bodega.pe" className="w-full outline-none text-sm"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600">Contraseña</label>
            <div className="flex items-center border rounded-lg px-3 py-2 mt-1">
              <Lock size={18} className="text-gray-400 mr-2" />
              <input 
                type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••" className="w-full outline-none text-sm"
              />
            </div>
          </div>

          <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-lg transition">
            Ingresar
          </button>
        </form>

        <p className="text-center text-xs text-gray-500 mt-6">
          ¿No tienes una cuenta de bodeguero?{' '}
          <Link to="/registro-bodeguero" className="text-blue-600 hover:underline">Regístrate aquí</Link>
        </p>
      </div>
    </div>
  );
}