# Contexto del proyecto

E-commerce hiperlocal de bodegas/kioscos para Lima Metropolitana.

- Backend: Django 6.1 + DRF + SimpleJWT + PostgreSQL (Render) + Cloudinary.
- Frontend: React 19 + Vite 8 + Tailwind 4 + React Router 7 + Leaflet + Axios.
- Idioma de la interfaz: español.
- Repositorio con dos carpetas: `backend/` y `frontend/`.

## Comandos

Backend (desde `backend/`):

```powershell
.\venv\Scripts\python.exe manage.py runserver 127.0.0.1:8000
.\venv\Scripts\python.exe manage.py check
.\venv\Scripts\python.exe manage.py makemigrations --check --dry-run
.\venv\Scripts\python.exe manage.py test api --settings=core.test_settings
.\venv\Scripts\python.exe manage.py test api --settings=core.test_settings_pg --timing --durations 10
.\venv\Scripts\python.exe manage.py seed_productos_demo --email mathicrack999@gmail.com
.\venv\Scripts\python.exe manage.py seed_e2e --settings=core.e2e_settings
```

Cobertura:

```powershell
.\venv\Scripts\python.exe -m coverage run --source=api,core manage.py test api --settings=core.test_settings_pg
.\venv\Scripts\python.exe -m coverage report -m
```

Pruebas de carga (Locust), con el backend corriendo:

```powershell
.\venv\Scripts\python.exe -m locust -f locustfile.py --host http://127.0.0.1:8000
```

Frontend (desde `frontend/`):

```powershell
npm run dev
npm run lint
npm run build
npm run test:e2e
```

La primera vez instalar el navegador de Playwright:

```powershell
npx playwright install chromium
```

El frontend apunta por defecto a `http://127.0.0.1:8000/api/`; el backend debe correr en el puerto 8000. Se puede sobreescribir con `VITE_API_URL`.

## Despliegue en Render

- Despliegue verificado en Render. Servicios: `proyecto-bodegas-api` (Django, plan free, `ohio`) y `proyecto-bodegas-web` (React static site).
- URLs: `https://proyecto-bodegas-web.onrender.com` y `https://proyecto-bodegas-api.onrender.com/api/`.
- La API usa la Internal Database URL de `DB-CI-V2` y `gunicorn`; el frontend usa `VITE_API_URL=https://proyecto-bodegas-api.onrender.com/api/`.
- `render.yaml` fija `PYTHON_VERSION=3.14.10` y `NODE_VERSION=24`.
- El static site requiere el rewrite `/* -> /index.html` para React Router.
- Variables sensibles (`DATABASE_URL`, `CLOUDINARY_URL`, `BREVO_API_KEY`, `DEFAULT_FROM_EMAIL`) se configuran en Render, no en el repositorio.
- OTP real por Brevo verificado en producción.
- Render Free duerme el Web Service tras 15 minutos sin tráfico y la PostgreSQL Free expira a los 30 días.

## Entorno y precauciones

- La base de datos es PostgreSQL remota compartida, configurada en `backend/.env` mediante `DATABASE_URL`.
- PostgreSQL 16 local instalado como servicio `postgresql-x64-16` en `127.0.0.1:5432`.
- Pruebas con PostgreSQL: base `bodegas_test`, usuario `bodegas_test`, contraseña `bodegas_test`; configuración en `core/test_settings_pg.py`.
- Pruebas E2E aisladas: base `bodegas_e2e`, configuración en `core/e2e_settings.py`; cuentas creadas por `seed_e2e`.
- No ejecutar migraciones ni comandos destructivos sin confirmación del usuario.
- La migración `api/0006` ya está aplicada.
- La migración `api/0007` (categorías por bodega, imagen Cloudinary y OTP) ya está aplicada en la BD remota.
- La migración `api/0008` (estado `LISTO_PARA_RECOGER` y conversión de pedidos de recojo) ya está aplicada en la BD remota.
- Las migraciones `api/0009`, `0010` y `0011` (idempotencia, cascadas seguras y snapshot de producto) ya están aplicadas en la BD remota.
- Imágenes de productos: `CLOUDINARY_URL` en `backend/.env`; la subida se hace desde el backend con `cloudinary.uploader`.
- Recuperación de contraseña por OTP de 6 dígitos: en producción se envía con Brevo HTTP API mediante `BREVO_API_KEY` y `DEFAULT_FROM_EMAIL`; sin esa clave usa consola en desarrollo.
- `core/test_settings.py` usa SQLite en memoria, email locmem y throttles altos para tests; no toca la BD remota.
- `core/test_settings_pg.py` y `core/e2e_settings.py` usan PostgreSQL local y no tocan la BD remota.
- Rate limiting con DRF: límites globales anónimo/usuario y scopes para login, registro, OTP y creación de pedidos.
- En desarrollo local el cache de throttling es `LocMemCache`; en producción usa `DatabaseCache` compartido entre workers.
- Autenticación: access token en memoria y refresh token en cookie `HttpOnly`; logout y blacklist con SimpleJWT.
- No commitear cambios sin pedido explícito.

## Datos demo

- El comando `seed_productos_demo` crea productos idempotentes para un vendedor.
- Productos agregados a `mathicrack999@gmail.com` (Bodega Math): Arroz extra 1 kg, Aceite vegetal 1 L, Leche entera 1 L, Agua mineral 600 ml, Detergente 780 g y Galletas de chocolate.
- Esos productos se crearon sin imagen; las imágenes quedan a cargo del usuario.

## Modelos y reglas de negocio

- `Usuario`: usuario custom con `USERNAME_FIELD = 'email'`; roles `BODEGUERO` y `CLIENTE`.
- `Bodega`: una por usuario; `radio_entrega_km` decimal, default `3.00`; `abierto`; teléfono peruano de 9 dígitos opcional.
- `Categoria`: pertenece a una bodega; nombre único por bodega; al crear una bodega se generan `Abarrotes`, `Bebidas`, `Limpieza`, `Snacks`, `Otros`; el bodeguero puede crear/eliminar las suyas.
- `Producto`: pertenece a una bodega y a una categoría de esa misma bodega; imagen opcional subida a Cloudinary (`imagen`, `imagen_public_id`).
- `PasswordResetOTP`: código de 6 dígitos hasheado, vence en 10 minutos, máximo 5 intentos y 3 solicitudes cada 15 minutos.
- `Pedido`: métodos `RECOJO`/`DELIVERY`, pagos `YAPE`/`PLIN`/`CONTRA_ENTREGA`; guarda `cliente`, coordenadas del cliente, `distancia_km` y claves de idempotencia.
- `DetallePedido`: guarda precio unitario y snapshot de `producto_nombre`; el producto puede quedar nulo sin perder el historial.
- `Bodega.usuario` y `Pedido.bodega` usan `PROTECT`; `Pedido.cliente` y `DetallePedido.producto` usan `SET_NULL`.

Reglas clave:

- El mapa público muestra solo bodegas abiertas dentro de su radio de entrega.
- Delivery exige coordenadas y valida el radio; recojo no exige ubicación.
- Backend valida stock, cantidades, métodos de entrega/pago y calcula el total con precios de BD.
- Crear pedido exige cliente autenticado, valida nombre/teléfono y asocia el pedido al `request.user`.
- Crear pedido es transaccional y usa `select_for_update` para descontar stock.
- Cancelar un pedido restaura el stock.
- Transiciones de estado según entrega:
  - Delivery: `PENDIENTE -> EN_PREPARACIÓN -> EN_CAMINO -> ENTREGADO`.
  - Recojo: `PENDIENTE -> EN_PREPARACIÓN -> LISTO_PARA_RECOGER -> ENTREGADO`.
  - Cancelación permitida desde estados no finales; `EN_CAMINO` no aplica a recojo y `LISTO_PARA_RECOGER` no aplica a delivery.
- El seguimiento de pedidos exige autenticación; solo el cliente dueño o el bodeguero dueño pueden verlo.
- El historial `cliente/pedidos/` lista únicamente los pedidos del usuario autenticado.

## Endpoints principales

- `POST auth/register/bodeguero/`
- `POST auth/login/` (login con email)
- `POST auth/refresh/`
- `POST auth/password-reset/request/`
- `POST auth/password-reset/verify/`
- `POST auth/password-reset/confirm/`
- `GET|POST bodega/mi-bodega/`
- `GET|POST bodega/categorias/`
- `GET|PUT|DELETE bodega/categorias/<id>/`
- `GET|POST bodega/productos/`
- `GET|PUT|DELETE bodega/productos/<id>/`
- `GET public/bodegas/?lat=&lng=`
- `GET public/bodegas/<id>/`
- `POST public/pedidos/crear/` (requiere cliente autenticado)
- `GET cliente/pedidos/`
- `GET cliente/pedidos/<id>/seguimiento/`
- `GET bodega/pedidos/`
- `PATCH bodega/pedidos/<id>/estado/`
- `PATCH bodega/pedidos/<id>/repartidor/`
- `GET bodega/reportes/ventas/`

## Frontend relevante

- `src/App.jsx`: rutas con `React.lazy` + `Suspense` para code-splitting; Login queda eager.
- `playwright.config.js` y `e2e/`: pruebas E2E; usan `E2E_BASE_URL` y `E2E_API_URL`. El login del vendedor se prueba si existen `E2E_SELLER_EMAIL` y `E2E_SELLER_PASSWORD`.
- `src/context/AuthContext.jsx` + `src/hooks/useAuth.js`: sesión reactiva, access token en memoria y restauración mediante refresh cookie.
- `src/api/client.js`: Axios con `withCredentials`, refresh automático ante 401 y renovación de sesión.
- `src/context/CartContext.jsx` + `src/hooks/useCart.js`: carrito global persistido en `localStorage` (`bodega_cart_v1`); un solo carrito y una sola bodega a la vez.
- `src/hooks/useGeolocation.js`: ubicación del cliente.
- `src/utils/geo.js`: Haversine en frontend y formateo de distancias.
- `src/utils/auth.js` y `src/utils/validators.js`: sesión y validación de teléfono peruano.
- `src/components/RequireAuth.jsx`: protección de rutas por login y rol.
- `src/components/CatalogoProductos.jsx` y `ProductoModal.jsx`: catálogo compartido y alta/edición con imagen.
- `src/pages/MapaCliente.jsx`: descubrimiento de bodegas, círculo de radio, búsqueda, sesión y acceso a pedidos.
- `src/pages/TiendaPage.jsx`: catálogo `/tienda/:id` y checkout en 4 pasos; confirmar exige sesión.
- `src/pages/MisPedidosPage.jsx`: historial del cliente autenticado.
- `src/pages/RecuperarPassword.jsx`: flujo OTP de recuperación.
- `src/pages/BodegaDashboard.jsx`: pestañas perfil, mi tienda, pedidos y reportes.
- `src/pages/BodegaPedidos.jsx`: pedidos, estados, distancia y mapa del repartidor.
- `src/pages/SeguimientoPedido.jsx`: seguimiento autenticado con polling, línea de tiempo según delivery/recojo y destino correcto.
- `src/index.css`: tokens Tailwind `brand` (verde), `accent` (ámbar) y `cream`.

Convenciones:

- Tailwind con clases estáticas; evitar construir nombres de clase dinámicamente.
- Iconos con `lucide-react`.
- No agregar comentarios al código salvo que sean necesarios.
- Mantener respuestas y UI en español.

## Estado actual

- Fase 0 de bugs críticos: completada.
- Fase 1A (radio por bodega, validación backend, tienda pública y rediseño cliente): completada.
- Fase 1B (categorías por bodega, imágenes Cloudinary, OTP, seguimiento autenticado, historial de cliente y unificación de diseño): implementada en código.
- Despliegue en Render y OTP real con Brevo: verificados.
- Code-splitting con `React.lazy` + `Suspense`: implementado; el bundle inicial bajó de ~562 kB a ~301 kB y las páginas pesadas se cargan por separado.
- Rate limiting por scopes en login, registro, OTP y creación de pedidos: implementado y probado.
- Pruebas E2E con Playwright: 12 aprobadas (escritorio y móvil) usando `core.e2e_settings` y `seed_e2e`; incluye checkout de recojo.
- Migraciones `0006`, `0007` y `0008` aplicadas en la BD compartida.
- Migraciones `0009`, `0010` y `0011` aplicadas en la BD compartida.
- Tests backend: 45 aprobados.
- Cobertura backend: 81%.
- `npm run lint` y `npm run build` aprobados.
- `pip-audit`: sin vulnerabilidades conocidas en dependencias backend.
- `npm audit`: solo quedan vulnerabilidades moderadas de desarrollo en ESLint/minimatch.
- `check --deploy`: sin advertencias.
- Hardening aplicado: fail-closed, password validators, JWT corto con rotación/blacklist, cookies HttpOnly, HSTS/HTTPS, health check y cache compartido.
- Validación de pedidos: coordenadas finitas, límites de payload, bloqueo ordenado e idempotencia.
- Paginación en listados de pedidos con botón “Cargar más” en el frontend.
- UX/Accesibilidad: labels asociados, toasts accesibles con autocierre, diálogos con Escape y `aria-modal`, foco visible, `lang="es"`, `prefers-reduced-motion` y verificación responsive en móvil.
- Estados de error con botón “Reintentar” en historial y reportes; polling de seguimiento se detiene en estados finales.
- Feedback al agregar al carrito, confirmación al reemplazar carrito y resumen de ítems en el checkout.
- Centro de ayuda (`/ayuda`) y aviso explícito de pago de demostración.
- Validación de imágenes Cloudinary (5 MB, JPG/PNG/WebP) con compensación ante fallos.
- Prueba de carga con Locust y chequeos de headers/CORS; pruebas de IDOR.
- Advertencia no bloqueante de Vite: rutas de imágenes de Leaflet sin resolver en build.

## Pendientes sugeridos

- Subir imágenes a los productos demo de Bodega Math.
- Auditoría con ZAP (requiere entorno con Docker/ZAP) y revisión con lector de pantalla.
- Completar hallazgos UX de Nielsen de menor prioridad (contraste de textos pequeños, unificación total de formato de precios, atajos de teclado).
