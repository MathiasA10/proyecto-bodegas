import { ArrowLeft, HelpCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const PREGUNTAS = [
  {
    titulo: '¿Cómo hago un pedido?',
    respuesta:
      'Entra al mapa, elige una bodega cercana, agrega productos al carrito y sigue los pasos de entrega, pago y confirmación.',
  },
  {
    titulo: '¿Recojo en tienda o pido delivery?',
    respuesta:
      'Puedes elegir “Recojo en tienda” sin costo o “Delivery” dentro del radio de entrega de la bodega.',
  },
  {
    titulo: '¿Cómo recupero mi contraseña?',
    respuesta:
      'En la pantalla de inicio de sesión elige “¿Olvidaste tu contraseña?” y te enviaremos un código de 6 dígitos a tu correo.',
  },
  {
    titulo: '¿Cómo sigo mi pedido?',
    respuesta:
      'En “Mis pedidos” toca “Ver seguimiento” para ver el estado y la ubicación en tiempo real.',
  },
];

export default function AyudaPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-cream-50">
      <header className="border-b border-brand-100 bg-white px-4 py-3">
        <div className="mx-auto flex max-w-3xl items-center gap-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label="Volver"
            className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-brand-700"
          >
            <ArrowLeft size={18} />
          </button>
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white">
            <HelpCircle size={18} />
          </span>
          <h1 className="text-lg font-extrabold text-slate-900">Centro de ayuda</h1>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        <div className="space-y-3">
          {PREGUNTAS.map((item) => (
            <article
              key={item.titulo}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <h2 className="text-sm font-bold text-slate-900">{item.titulo}</h2>
              <p className="mt-1 text-sm text-slate-600">{item.respuesta}</p>
            </article>
          ))}
        </div>

        <div className="mt-6 rounded-2xl border border-brand-100 bg-brand-50 p-4 text-sm text-brand-800">
          <p className="font-semibold">¿Necesitas más ayuda?</p>
          <p className="mt-1">
            Contáctate directamente con la bodega a través del teléfono que aparece en su tienda.
          </p>
        </div>
      </main>
    </div>
  );
}
