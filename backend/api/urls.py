from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .views import (
    CrearPedidoView,
    RegistroBodegueroView,
    CustomTokenObtainPairView,
    BodegaDetailView,
    ProductoListCreateView,
    BodegasPublicasListView,
)

urlpatterns = [
    # HU-01 y HU-02
    path('auth/register/bodeguero/', RegistroBodegueroView.as_view(), name='registro_bodeguero'),
    path('auth/login/', CustomTokenObtainPairView.as_view(), name='login'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    
    # HU-03: Perfil de Bodega
    path('bodega/mi-bodega/', BodegaDetailView.as_view(), name='mi_bodega'),
    
    # HU-04: Productos
    path('bodega/productos/', ProductoListCreateView.as_view(), name='mis_productos'),
    
    path('public/bodegas/', BodegasPublicasListView.as_view(), name='bodegas_publicas'),
    path('public/pedidos/crear/', CrearPedidoView.as_view(), name='crear_pedido'),
]