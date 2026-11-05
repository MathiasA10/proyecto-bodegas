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
```

Frontend (desde `frontend/`):

```powershell
npm run dev
npm run lint
npm run build
```

El frontend apunta por defecto a `http://127.0.0.1:8000/api/`; el backend debe correr en el puerto 8000. Se puede sobreescribir con `VITE_API_URL`.

## Despliegue en Render

- `render.yaml` define dos servicios en la región `ohio`: `proyecto-bodegas-api` (Django, plan free) y `proyecto-bodegas-web` (React static site).
- La API usa la Internal Database URL de `DB-CI-V2` y `gunicorn`; el frontend usa `VITE_API_URL=https://proyecto-bodegas-api.onrender.com/api/`.
- El static site requiere el rewrite `/* -> /index.html` para React Router.
- Variables sensibles (`DATABASE_URL`, `CLOUDINARY_URL`, `BREVO_API_KEY`, `DEFAULT_FROM_EMAIL`) se configuran en Render, no en el repositorio.
- Render Free duerme el Web Service tras 15 minutos sin tráfico y la PostgreSQL Free expira a los 30 días.

## Entorno y precauciones

- La base de datos es PostgreSQL remota compartida, configurada en `backend/.env` mediante `DATABASE_URL`.
- No ejecutar migraciones ni comandos destructivos sin confirmación del usuario.
- La migración `api/0006` ya está aplicada.
- La migración `api/0007` (categorías por bodega, imagen Cloudinary y OTP) ya está aplicada en la BD remota.
- La migración `api/0008` (estado `LISTO_PARA_RECOGER` y conversión de pedidos de recojo) ya está aplicada en la BD remota.
- Imágenes de productos: `CLOUDINARY_URL` en `backend/.env`; la subida se hace desde el backend con `cloudinary.uploader`.
- Recuperación de contraseña por OTP de 6 dígitos: en producción se envía con Brevo HTTP API mediante `BREVO_API_KEY` y `DEFAULT_FROM_EMAIL`; sin esa clave usa consola en desarrollo.
- `core/test_settings.py` usa SQLite en memoria y email locmem para tests; no toca la BD remota.
- No commitear cambios sin pedido explícito.

## Modelos y reglas de negocio

- `Usuario`: usuario custom con `USERNAME_FIELD = 'email'`; roles `BODEGUERO` y `CLIENTE`.
- `Bodega`: una por usuario; `radio_entrega_km` decimal, default `3.00`; `abierto`; teléfono peruano de 9 dígitos opcional.
- `Categoria`: pertenece a una bodega; nombre único por bodega; al crear una bodega se generan `Abarrotes`, `Bebidas`, `Limpieza`, `Snacks`, `Otros`; el bodeguero puede crear/eliminar las suyas.
- `Producto`: pertenece a una bodega y a una categoría de esa misma bodega; imagen opcional subida a Cloudinary (`imagen`, `imagen_public_id`).
- `PasswordResetOTP`: código de 6 dígitos hasheado, vence en 10 minutos, máximo 5 intentos y 3 solicitudes cada 15 minutos.
- `Pedido`: métodos `RECOJO`/`DELIVERY`, pagos `YAPE`/`PLIN`/`CONTRA_ENTREGA`; guarda `cliente`, coordenadas del cliente y `distancia_km`.
- `DetallePedido`: guarda precio unitario histórico.

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

- `src/api/client.js`: Axios, token automático salvo login/registro/refresh/recuperación, limpieza de sesión en 401.
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
- Migraciones `0006`, `0007` y `0008` aplicadas en la BD compartida.
- Datos E2E eliminados; no deben quedar usuarios, bodegas, productos ni pedidos con prefijo `E2E`.
- Tests backend: 32 aprobados.
- `npm run lint` y `npm run build` aprobados.
- Configuración de despliegue `render.yaml` y Brevo implementada; falta crear el Blueprint y verificar OTP real en Render.
- Advertencia no bloqueante de Vite: bundle mayor a 500 kB y rutas de imágenes de Leaflet sin resolver en build.
- Advertencia no bloqueante de `check --deploy`: faltan `SECURE_HSTS_SECONDS` y `SECURE_SSL_REDIRECT`; Render ya fuerza HTTPS en el borde.

## Pendientes sugeridos

- Verificar envío real de OTP con Brevo en Render.
- Crear el Blueprint en Render y validar ambos servicios.
- Datos demo/seed.
- Code-splitting del bundle del frontend.
- Otros pendientes: endurecer rate limiting, revisar accesibilidad y automatizar E2E con Playwright.
