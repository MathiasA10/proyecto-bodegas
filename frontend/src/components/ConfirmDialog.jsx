import { useEffect, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';

export default function ConfirmDialog({
  abierto,
  titulo = '¿Confirmar acción?',
  mensaje,
  confirmarTexto = 'Confirmar',
  cancelarTexto = 'Cancelar',
  peligro = true,
  cargando = false,
  onConfirmar,
  onCancelar,
}) {
  const botonCancelarRef = useRef(null);

  useEffect(() => {
    if (!abierto) return undefined;

    function manejarTecla(evento) {
      if (evento.key === 'Escape') {
        onCancelar?.();
      }
    }

    window.addEventListener('keydown', manejarTecla);
    botonCancelarRef.current?.focus();
    return () => window.removeEventListener('keydown', manejarTecla);
  }, [abierto, onCancelar]);

  if (!abierto) return null;

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-center justify-center bg-slate-900/50 p-4"
      onClick={onCancelar}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirmar-titulo"
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
        onClick={(evento) => evento.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
              peligro ? 'bg-red-100 text-red-600' : 'bg-brand-100 text-brand-700'
            }`}
          >
            <AlertTriangle size={20} />
          </span>
          <div>
            <h2 id="confirmar-titulo" className="text-base font-bold text-slate-900">
              {titulo}
            </h2>
            {mensaje && <p className="mt-1 text-sm text-slate-500">{mensaje}</p>}
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            ref={botonCancelarRef}
            onClick={onCancelar}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            {cancelarTexto}
          </button>
          <button
            type="button"
            onClick={onConfirmar}
            disabled={cargando}
            className={`rounded-xl px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-60 ${
              peligro
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-brand-600 hover:bg-brand-700'
            }`}
          >
            {cargando ? 'Procesando...' : confirmarTexto}
          </button>
        </div>
      </div>
    </div>
  );
}
