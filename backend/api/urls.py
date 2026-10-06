from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .views import (
    RegistroBodegueroView,
    CustomTokenObtainPairView,
    BodegaDetailView,
    ProductoListCreateView,
    BodegasPublicasListView,
    CrearPedidoView,
    BodegaPedidosListView,
    CambiarEstadoPedidoView,
    SeguimientoPedidoView,
    ReporteVentasView,
)

urlpatterns = [
    # Sprint 1: Auth y Bodega
    path('auth/register/bodeguero/', RegistroBodegueroView.as_view(), name='registro_bodeguero'),
    path('auth/login/', CustomTokenObtainPairView.as_view(), name='login'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('bodega/mi-bodega/', BodegaDetailView.as_view(), name='mi_bodega'),
    path('bodega/productos/', ProductoListCreateView.as_view(), name='mis_productos'),
    
    # Sprint 2 y 3: Vista pública, catálogo y crear pedido
    path('public/bodegas/', BodegasPublicasListView.as_view(), name='bodegas_publicas'),
    path('public/pedidos/crear/', CrearPedidoView.as_view(), name='crear_pedido'),
    
    # Sprint 4: Gestión de pedidos, estados y reportes
    path('bodega/pedidos/', BodegaPedidosListView.as_view(), name='bodega_pedidos'),
    path('bodega/pedidos//estado/', CambiarEstadoPedidoView.as_view(), name='cambiar_estado_pedido'),
    path('bodega/reportes/ventas/', ReporteVentasView.as_view(), name='reporte_ventas'),
    path('public/pedidos//seguimiento/', SeguimientoPedidoView.as_view(), name='seguimiento_pedido'),
]