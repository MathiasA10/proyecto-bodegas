from django.urls import path
from .auth_views import CookieTokenRefreshView, LogoutView
from .password_reset import (
    ConfirmarPasswordResetView,
    SolicitarCodigoPasswordResetView,
    VerificarCodigoPasswordResetView,
)
from .views import (
    RegistroBodegueroView,
    CustomTokenObtainPairView,
    BodegaDetailView,
    CategoriaListCreateView,
    CategoriaDetailView,
    ProductoListCreateView,
    ProductoDetailView,
    BodegasPublicasListView,
    BodegaPublicaDetailView,
    CrearPedidoView,
    BodegaPedidosListView,
    MisPedidosView,
    CambiarEstadoPedidoView,
    SeguimientoPedidoView,
    ReporteVentasView,
    ActualizarRepartidorView,
)

urlpatterns = [
    # Sprint 1: Auth y Bodega
    path('auth/register/bodeguero/', RegistroBodegueroView.as_view(), name='registro_bodeguero'),
    path('auth/login/', CustomTokenObtainPairView.as_view(), name='login'),
    path('auth/refresh/', CookieTokenRefreshView.as_view(), name='token_refresh'),
    path('auth/logout/', LogoutView.as_view(), name='logout'),
    path('auth/password-reset/request/', SolicitarCodigoPasswordResetView.as_view(), name='password_reset_request'),
    path('auth/password-reset/verify/', VerificarCodigoPasswordResetView.as_view(), name='password_reset_verify'),
    path('auth/password-reset/confirm/', ConfirmarPasswordResetView.as_view(), name='password_reset_confirm'),
    path('bodega/mi-bodega/', BodegaDetailView.as_view(), name='mi_bodega'),
    path('bodega/categorias/', CategoriaListCreateView.as_view(), name='mis_categorias'),
    path('bodega/categorias/<int:pk>/', CategoriaDetailView.as_view(), name='detalle_categoria'),
    path('bodega/productos/', ProductoListCreateView.as_view(), name='mis_productos'),
    path('bodega/productos/<int:pk>/', ProductoDetailView.as_view(), name='detalle_producto'),
    
    # Sprint 2 y 3: Vista pública, catálogo y crear pedido
    path('public/bodegas/', BodegasPublicasListView.as_view(), name='bodegas_publicas'),
    path('public/bodegas/<int:pk>/', BodegaPublicaDetailView.as_view(), name='bodega_publica_detalle'),
    path('public/pedidos/crear/', CrearPedidoView.as_view(), name='crear_pedido'),
    
    # Sprint 4: Gestión de pedidos, estados y reportes
    path('bodega/pedidos/', BodegaPedidosListView.as_view(), name='bodega_pedidos'),
    path('bodega/pedidos/<int:pk>/estado/', CambiarEstadoPedidoView.as_view(), name='cambiar_estado_pedido'),
    path('bodega/pedidos/<int:pk>/repartidor/', ActualizarRepartidorView.as_view(), name='actualizar_repartidor'),
    path('bodega/reportes/ventas/', ReporteVentasView.as_view(), name='reporte_ventas'),

    # Cliente autenticado: historial y seguimiento de pedidos
    path('cliente/pedidos/', MisPedidosView.as_view(), name='mis_pedidos'),
    path('cliente/pedidos/<int:pk>/seguimiento/', SeguimientoPedidoView.as_view(), name='seguimiento_pedido'),
]