import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../api/client';
import { Store, Lock, Mail, User, UserPlus, Eye, EyeOff, CheckCircle2, AlertCircle } from 'lucide-react';

export default function Login() {
  const [mode, setMode] = useState('login');
  const [role, setRole] = useState('CLIENTE');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

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
    setExito('');
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
        navigate(location.state?.from || '/mapa');
      }
    } catch {
      setError('Correo o contraseña incorrectos');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setExito('');
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
      setExito('¡Cuenta creada con éxito! Ahora inicia sesión.');
      setMode('login');
      setEmail(regForm.email);
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
    setExito('');
  };

  const roleLabels = {
    CLIENTE: 'Soy Cliente (Comprar)',
    BODEGUERO: 'Soy Bodeguero (Vender)'
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-cream-50 px-4 py-12">
      <div className="max-w-md w-full bg-white rounded-3xl border border-brand-100 shadow-lg p-8">
        <div className="flex flex-col items-center mb-6">
          <div className="p-3 bg-brand-600 rounded-2xl text-white mb-2">
            <Store size={32} />
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900">
            {mode === 'login' ? 'Iniciar Sesión' : 'Crear Cuenta'}
          </h2>
          <p className="text-sm text-slate-500">Plataforma de Bodegas Lima</p>
        </div>

        {mode === 'register' && (
          <div className="mb-6">
            <label className="text-xs font-semibold text-slate-600 block mb-2">Tipo de cuenta</label>
            <div className="grid grid-cols-2 gap-2">
              {['CLIENTE', 'BODEGUERO'].map(r => (
                <button
                  key={r}
                  type="button"
                  onClick={() => { setRole(r); setRegForm(prev => ({ ...prev, rol: r })); }}
                  className={`p-3 rounded-xl border-2 text-sm font-medium transition ${
                    role === r
                      ? 'border-brand-600 bg-brand-50 text-brand-800'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300'
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

        {error && (
          <div className="p-3 mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl flex items-start gap-2">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {exito && (
          <div className="p-3 mb-4 bg-brand-50 border border-brand-200 text-brand-800 text-sm rounded-xl flex items-start gap-2">
            <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
            <span>{exito}</span>
          </div>
        )}

        {mode === 'login' ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-600">Correo Electrónico</label>
              <div className="flex items-center border border-slate-200 rounded-xl px-3 py-2 mt-1 focus-within:border-brand-500">
                <Mail size={18} className="text-slate-400 mr-2" />
                <input
                  type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="ejemplo@correo.com" className="w-full outline-none text-sm"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-600">Contraseña</label>
                <button
                  type="button"
                  onClick={() => navigate('/recuperar-password')}
                  className="text-[11px] font-semibold text-brand-700 hover:text-brand-800"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
              <div className="flex items-center border border-slate-200 rounded-xl px-3 py-2 mt-1 relative focus-within:border-brand-500">
                <Lock size={18} className="text-slate-400 mr-2" />
                <input
                  type={showPassword ? 'text' : 'password'} required value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••" className="w-full outline-none text-sm pr-8"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading} className="w-full bg-brand-600 hover:bg-brand-700 disabled:bg-brand-300 text-white font-semibold py-2.5 rounded-xl transition">
              {loading ? 'Ingresando...' : 'Ingresar'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegister} className="space-y-3">
            <div>
              <label className="text-xs text-slate-600 font-medium">Nombre de usuario</label>
              <input
                name="username" required onChange={handleRegChange}
                value={regForm.username}
                placeholder="usuario123" className="w-full border border-slate-200 p-2 rounded-xl text-sm outline-none mt-1 focus:border-brand-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-slate-600 font-medium">Nombres</label>
                <input
                  name="first_name" required onChange={handleRegChange}
                  value={regForm.first_name}
                  placeholder="Juan" className="w-full border border-slate-200 p-2 rounded-xl text-sm outline-none mt-1 focus:border-brand-500"
                />
              </div>
              <div>
                <label className="text-xs text-slate-600 font-medium">Apellidos</label>
                <input
                  name="last_name" required onChange={handleRegChange}
                  value={regForm.last_name}
                  placeholder="Pérez" className="w-full border border-slate-200 p-2 rounded-xl text-sm outline-none mt-1 focus:border-brand-500"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-600 font-medium">DNI (opcional)</label>
              <input
                name="dni" maxLength="8" onChange={handleRegChange}
                value={regForm.dni || ''}
                placeholder="12345678" className="w-full border border-slate-200 p-2 rounded-xl text-sm outline-none mt-1 focus:border-brand-500"
              />
            </div>

            <div>
              <label className="text-xs text-slate-600 font-medium">Correo Electrónico</label>
              <input
                name="email" type="email" required onChange={handleRegChange}
                value={regForm.email}
                placeholder="correo@ejemplo.com" className="w-full border border-slate-200 p-2 rounded-xl text-sm outline-none mt-1 focus:border-brand-500"
              />
            </div>

            <div>
              <label className="text-xs text-slate-600 font-medium">Contraseña</label>
              <div className="flex items-center border border-slate-200 rounded-xl px-3 py-2 mt-1 relative focus-within:border-brand-500">
                <Lock size={18} className="text-slate-400 mr-2" />
                <input
                  name="password" type={showPassword ? 'text' : 'password'} required onChange={handleRegChange}
                  value={regForm.password}
                  placeholder="••••••••" className="w-full outline-none text-sm pr-8"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-600 font-medium">Confirmar Contraseña</label>
              <input
                name="confirmPassword" type={showPassword ? 'text' : 'password'} required onChange={handleRegChange}
                value={regForm.confirmPassword}
                placeholder="••••••••" className="w-full border border-slate-200 p-2 rounded-xl text-sm outline-none mt-1 focus:border-brand-500"
              />
            </div>

            <button type="submit" disabled={loading} className="w-full bg-brand-600 hover:bg-brand-700 disabled:bg-brand-300 text-white py-2.5 rounded-xl text-sm font-semibold mt-3 transition">
              {loading ? 'Creando cuenta...' : 'Crear Cuenta'}
            </button>
          </form>
        )}

        <p className="text-center text-xs text-slate-500 mt-6">
          {mode === 'login'
            ? '¿No tienes cuenta? '
            : '¿Ya tienes cuenta? '
          }
          <button
            onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}
            className="text-brand-700 hover:underline font-semibold"
          >
            {mode === 'login' ? 'Crear cuenta' : 'Iniciar sesión'}
          </button>
        </p>
      </div>
    </div>
  );
}
