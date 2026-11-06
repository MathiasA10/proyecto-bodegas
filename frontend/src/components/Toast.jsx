import { useEffect } from 'react';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';

export default function Toast({ tipo = 'success', texto, onClose }) {
  useEffect(() => {
    if (!texto || !onClose) return undefined;
    const temporizador = setTimeout(onClose, 5000);
    return () => clearTimeout(temporizador);
  }, [texto, onClose]);

  if (!texto) return null;

  const esExito = tipo === 'success';
  const Icono = esExito ? CheckCircle2 : AlertCircle;

  return (
    <div
      role={esExito ? 'status' : 'alert'}
      aria-live={esExito ? 'polite' : 'assertive'}
      className="fixed right-4 top-4 z-[1200] w-[calc(100%-2rem)] max-w-sm"
    >
      <div
        className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-sm shadow-lg ${
          esExito
            ? 'border-brand-200 bg-white text-brand-800'
            : 'border-red-200 bg-white text-red-700'
        }`}
      >
        <Icono size={18} className="mt-0.5 shrink-0" />
        <p className="flex-1">{texto}</p>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 transition hover:text-slate-600"
            aria-label="Cerrar aviso"
          >
            <X size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
