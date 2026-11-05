import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, KeyRound, Loader2, Mail, ShieldCheck } from 'lucide-react';

import api from '../api/client';

export default function RecuperarPassword() {
  const navigate = useNavigate();
  const [paso, setPaso] = useState(1);
  const [email, setEmail] = useState('');
  const [codigo, setCodigo] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const solicitarCodigo = async (evento) => {
    evento.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('auth/password-reset/request/', { email: email.trim() });
      setPaso(2);
    } catch (err) {
      setError(
        err.response?.data?.error ||
          'No pudimos enviar el código. Verifica tu correo e intenta de nuevo.'
      );
    } finally {
      setLoading(false);
    }
  };

  const verificarYCambiar = async (evento) => {
    evento.preventDefault();
    setError('');
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setLoading(true);
    try {
      const verificacion = await api.post('auth/password-reset/verify/', {
        email: email.trim(),
        codigo: codigo.trim(),
      });
      const token = verificacion.data.reset_token;
      await api.post('auth/password-reset/confirm/', {
        reset_token: token,
        password,
      });
      setPaso(3);
    } catch (err) {
      setError(
        err.response?.data?.error ||
          'No pudimos restablecer la contraseña. Intenta nuevamente.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream-50 px-4 py-12">
      <div className="w-full max-w-md rounded-3xl border border-brand-100 bg-white p-8 shadow-lg">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="mb-5 flex items-center gap-1 text-xs font-semibold text-slate-500 transition hover:text-brand-700"
        >
          <ArrowLeft size={14} /> Volver al inicio de sesión
        </button>

        <div className="flex flex-col items-center text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 text-white">
            {paso === 3 ? <CheckCircle2 size={26} /> : <ShieldCheck size={26} />}
          </span>
          <h1 className="mt-3 text-xl font-extrabold text-slate-900">
            {paso === 3 ? 'Contraseña actualizada' : 'Recuperar contraseña'}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {paso === 1 && 'Te enviaremos un código de 6 dígitos a tu correo.'}
            {paso === 2 && `Ingresa el código enviado a ${email}.`}
            {paso === 3 && 'Ya puedes iniciar sesión con tu nueva contraseña.'}
          </p>
        </div>

        {error && (
          <p className="mt-5 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
            {error}
          </p>
        )}

        {paso === 1 && (
          <form onSubmit={solicitarCodigo} className="mt-6 space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-600">
                Correo electrónico
              </label>
              <div className="mt-1 flex items-center rounded-xl border border-slate-200 px-3 py-2 focus-within:border-brand-500">
                <Mail size={18} className="mr-2 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ejemplo@correo.com"
                  className="w-full text-sm outline-none"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
            >
              {loading && <Loader2 size={15} className="animate-spin" />}
              {loading ? 'Enviando código...' : 'Enviar código'}
            </button>
          </form>
        )}

        {paso === 2 && (
          <form onSubmit={verificarYCambiar} className="mt-6 space-y-3">
            <div>
              <label className="text-xs font-semibold text-slate-600">
                Código de verificación
              </label>
              <div className="mt-1 flex items-center rounded-xl border border-slate-200 px-3 py-2 focus-within:border-brand-500">
                <KeyRound size={18} className="mr-2 text-slate-400" />
                <input
                  inputMode="numeric"
                  maxLength={6}
                  required
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  className="w-full text-sm tracking-[0.4em] outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600">
                Nueva contraseña
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-brand-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600">
                Confirmar contraseña
              </label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-brand-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
            >
              {loading && <Loader2 size={15} className="animate-spin" />}
              {loading ? 'Verificando...' : 'Cambiar contraseña'}
            </button>

            <button
              type="button"
              onClick={() => setPaso(1)}
              className="w-full text-center text-[11px] font-semibold text-slate-500 hover:text-slate-700"
            >
              Usar otro correo
            </button>
          </form>
        )}

        {paso === 3 && (
          <button
            type="button"
            onClick={() => navigate('/')}
            className="mt-6 w-full rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
          >
            Iniciar sesión
          </button>
        )}
      </div>
    </div>
  );
}
