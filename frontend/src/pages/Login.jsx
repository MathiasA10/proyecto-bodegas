import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { Store, Lock, Mail, User, UserPlus, Eye, EyeOff } from 'lucide-react';

export default function Login() {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [role, setRole] = useState('CLIENTE'); // 'CLIENTE' | 'BODEGUERO'
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Login form
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Register form
  const [regForm, setRegForm] = useState({
    username: '',
    email: '',
    first_name: '',
    last_name: '',
    dni: '',
    password: '',
    confirmPassword: '',
    rol: 'CLIENTE'
  });

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post('auth/login/', { email, password });
      localStorage.setItem('access_token', res.data.access);
      localStorage.setItem('refresh_token', res.data.refresh);
      localStorage.setItem('user_rol', res.data.rol);
      localStorage.setItem('user_nombre', res.data.nombre);
      localStorage.setItem('user_id', res.data.id);

      if (res.data.rol === 'BODEGUERO') {
        navigate('/bodega/dashboard');
      } else {
        navigate('/mapa');
      }
    } catch (err) {
      setError('Correo o contraseña incorrectos');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    if (regForm.password !== regForm.confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }
    if (regForm.password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    setLoading(true);
    try {
      const payload = {
        username: regForm.username,
        email: regForm.email,
        first_name: regForm.first_name,
        last_name: regForm.last_name,
        dni: regForm.dni || undefined,
        password: regForm.password,
        rol: regForm.rol
      };
      await api.post('auth/register/bodeguero/', payload);
      alert('¡Cuenta creada con éxito! Ahora inicia sesión.');
      setMode('login');
      setRegForm({ username: '', email: '', first_name: '', last_name: '', dni: '', password: '', confirmPassword: '', rol: role });
    } catch (err) {
      if (err.response?.data) {
        const errors = err.response.data;
        const msg = Object.entries(errors)
          .map(([key, val]) => `${key}: ${Array.isArray(val) ? val.join(' ') : val}`)
          .join(' | ');
        setError(msg);
      } else {
        setError('Error de conexión con el servidor');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegChange = (e) => {
    const { name, value } = e.target;
    setRegForm(prev => ({ ...prev, [name]: value }));
  };

  const switchMode = (newMode) => {
    setMode(newMode);
    setError('');
  };

  const roleLabels = {
    CLIENTE: 'Soy Cliente (Comprar)',
    BODEGUERO: 'Soy Bodeguero (Vender)'
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8">
        <div className="flex flex-col items-center mb-6">
          <div className="p-3 bg-blue-100 rounded-full text-blue-600 mb-2">
            <Store size={32} />
          </div>
          <h2 className="text-2xl font-bold text-gray-800">
            {mode === 'login' ? 'Iniciar Sesión' : 'Crear Cuenta'}
          </h2>
          <p className="text-sm text-gray-500">Plataforma de Bodegas Lima</p>
        </div>

        {/* Role Selector (only in register mode) */}
        {mode === 'register' && (
          <div className="mb-6">
            <label className="text-xs font-semibold text-gray-600 block mb-2">Tipo de cuenta</label>
            <div className="grid grid-cols-2 gap-2">
              {['CLIENTE', 'BODEGUERO'].map(r => (
                <button
                  key={r}
                  type="button"
                  onClick={() => { setRole(r); setRegForm(prev => ({ ...prev, rol: r })); }}
                  className={`p-3 rounded-lg border-2 text-sm font-medium transition ${
                    role === r
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    {r === 'CLIENTE' ? <UserPlus size={18} /> : <User size={18} />}
                    <span>{roleLabels[r]}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {error && <div className="p-3 mb-4 bg-red-100 text-red-700 text-sm rounded-lg">{error}</div>}

        {mode === 'login' ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-gray-600">Correo Electrónico</label>
              <div className="flex items-center border rounded-lg px-3 py-2 mt-1">
                <Mail size={18} className="text-gray-400 mr-2" />
                <input 
                  type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="ejemplo@correo.com" className="w-full outline-none text-sm"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-600">Contraseña</label>
              <div className="flex items-center border rounded-lg px-3 py-2 mt-1">
                <Lock size={18} className="text-gray-400 mr-2" />
                <input 
                  type={showPassword ? 'text' : 'password'} required value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••" className="w-full outline-none text-sm pr-8"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium py-2 rounded-lg transition">
              {loading ? 'Ingresando...' : 'Ingresar'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegister} className="space-y-3">
            <div>
              <label className="text-xs text-gray-600 font-medium">Nombre de usuario</label>
              <input 
                name="username" required onChange={handleRegChange} 
                value={regForm.username}
                placeholder="usuario123" className="w-full border p-2 rounded text-sm outline-none mt-1" 
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-gray-600 font-medium">Nombres</label>
                <input 
                  name="first_name" required onChange={handleRegChange} 
                  value={regForm.first_name}
                  placeholder="Juan" className="w-full border p-2 rounded text-sm outline-none mt-1" 
                />
              </div>
              <div>
                <label className="text-xs text-gray-600 font-medium">Apellidos</label>
                <input 
                  name="last_name" required onChange={handleRegChange} 
                  value={regForm.last_name}
                  placeholder="Pérez" className="w-full border p-2 rounded text-sm outline-none mt-1" 
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-600 font-medium">DNI (opcional)</label>
              <input 
                name="dni" maxLength="8" onChange={handleRegChange} 
                value={regForm.dni || ''}
                placeholder="72794425" className="w-full border p-2 rounded text-sm outline-none mt-1" 
              />
            </div>

            <div>
              <label className="text-xs text-gray-600 font-medium">Correo Electrónico</label>
              <input 
                name="email" type="email" required onChange={handleRegChange} 
                value={regForm.email}
                placeholder="correo@ejemplo.com" className="w-full border p-2 rounded text-sm outline-none mt-1" 
              />
            </div>

            <div>
              <label className="text-xs text-gray-600 font-medium">Contraseña</label>
              <div className="flex items-center border rounded-lg px-3 py-2 mt-1 relative">
                <Lock size={18} className="text-gray-400 mr-2" />
                <input 
                  name="password" type={showPassword ? 'text' : 'password'} required onChange={handleRegChange} 
                  value={regForm.password}
                  placeholder="••••••••" className="w-full outline-none text-sm pr-8"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-600 font-medium">Confirmar Contraseña</label>
              <input 
                name="confirmPassword" type={showPassword ? 'text' : 'password'} required onChange={handleRegChange} 
                value={regForm.confirmPassword}
                placeholder="••••••••" className="w-full border p-2 rounded text-sm outline-none mt-1" 
              />
            </div>

            <button type="submit" disabled={loading} className="w-full bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white py-2 rounded-lg text-sm font-medium mt-3 transition">
              {loading ? 'Creando cuenta...' : 'Crear Cuenta'}
            </button>
          </form>
        )}

        <p className="text-center text-xs text-gray-500 mt-6">
          {mode === 'login' 
            ? '¿No tienes cuenta? '
            : '¿Ya tienes cuenta? '
          }
          <button
            onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}
            className="text-blue-600 hover:underline font-medium"
          >
            {mode === 'login' ? 'Crear cuenta' : 'Iniciar sesión'}
          </button>
        </p>
      </div>
    </div>
  );
}