import { AlertTriangle } from 'lucide-react';

export default function ConfirmDialog({
  abierto,
  titulo = '¿Confirmar acción?',
  mensaje,
  confirmarTexto = 'Confirmar',
  cancelarTexto = 'Cancelar',
  peligro = true,
  onConfirmar,
  onCancelar,
}) {
  if (!abierto) return null;

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-start gap-3">
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
              peligro ? 'bg-red-100 text-red-600' : 'bg-brand-100 text-brand-700'
            }`}
          >
            <AlertTriangle size={20} />
          </span>
          <div>
            <h2 className="text-base font-bold text-slate-900">{titulo}</h2>
            {mensaje && <p className="mt-1 text-sm text-slate-500">{mensaje}</p>}
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancelar}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            {cancelarTexto}
          </button>
          <button
            type="button"
            onClick={onConfirmar}
            className={`rounded-xl px-4 py-2 text-sm font-semibold text-white transition ${
              peligro
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-brand-600 hover:bg-brand-700'
            }`}
          >
            {confirmarTexto}
          </button>
        </div>
      </div>
    </div>
  );
}
