from decimal import Decimal
from django.db import transaction
from rest_framework import generics, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import Usuario, Bodega, Producto, Pedido, DetallePedido
from .serializers import (
    RegistroUsuarioSerializer,
    BodegaSerializer,
    ProductoSerializer,
    BodegaPublicaSerializer,
    PedidoSerializer,
)

# ==========================================
# SPRINT 1: AUTENTICACIÓN Y GESTIÓN BODEGA
# ==========================================

# HU-02: Token personalizado con rol y datos de sesión
class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)
        data['rol'] = self.user.rol
        data['nombre'] = self.user.first_name
        data['email'] = self.user.email
        return data

class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer

# HU-01: Registro Bodeguero
class RegistroBodegueroView(generics.CreateAPIView):
    queryset = Usuario.objects.all()
    serializer_class = RegistroUsuarioSerializer
    permission_classes = [permissions.AllowAny]

# HU-03: Registrar y Consultar Perfil de Bodega (GET / POST idempotente)
class BodegaDetailView(generics.GenericAPIView):
    serializer_class = BodegaSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, *args, **kwargs):
        bodega = Bodega.objects.filter(usuario=request.user).first()
        if not bodega:
            return Response({}, status=status.HTTP_200_OK)
        serializer = self.get_serializer(bodega)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request, *args, **kwargs):
        bodega = Bodega.objects.filter(usuario=request.user).first()
        data = request.data.copy()
        data['abierto'] = True  # Visibilidad pública garantizada

        if bodega:
            serializer = self.get_serializer(bodega, data=data, partial=True)
        else:
            serializer = self.get_serializer(data=data)

        if serializer.is_valid():
            serializer.save(usuario=request.user, abierto=True)
            return Response(
                serializer.data,
                status=status.HTTP_200_OK if bodega else status.HTTP_201_CREATED
            )
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

# HU-04: Listar y Crear Productos de la Bodega Autenticada
class ProductoListCreateView(generics.ListCreateAPIView):
    serializer_class = ProductoSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Producto.objects.filter(bodega__usuario=self.request.user)

    def perform_create(self, serializer):
        bodega = Bodega.objects.filter(usuario=self.request.user).first()
        if not bodega:
            return Response(
                {"detail": "Primero debes configurar el perfil y ubicación de tu bodega."},
                status=status.HTTP_400_BAD_REQUEST
            )
        serializer.save(bodega=bodega)


# ==========================================
# SPRINT 2: VISTA CLIENTE, MAPA Y PEDIDOS
# ==========================================

# Endpoint público: listar bodegas registradas con catálogo en el mapa
class BodegasPublicasListView(generics.ListAPIView):
    queryset = Bodega.objects.all()
    serializer_class = BodegaPublicaSerializer
    permission_classes = [permissions.AllowAny]

# Endpoint para procesar el pedido del cliente y descontar stock transaccional
class CrearPedidoView(APIView):
    permission_classes = [permissions.AllowAny]

    @transaction.atomic
    def post(self, request):
        data = request.data
        items = data.get('items', [])
        
        if not items:
            return Response(
                {'error': 'El carrito no contiene productos.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        bodega_id = data.get('bodega_id')
        bodega = Bodega.objects.filter(id=bodega_id).first()
        if not bodega:
            return Response(
                {'error': 'Bodega no encontrada.'},
                status=status.HTTP_404_NOT_FOUND
            )

        total = Decimal('0.00')

        # 1. Validar existencias de stock
        for item in items:
            producto_id = item.get('id')
            cantidad = int(item.get('cantidad', 1))

            prod = Producto.objects.select_for_update().filter(id=producto_id, bodega=bodega).first()
            if not prod:
                return Response(
                    {'error': f"Producto con ID {producto_id} no pertenece a esta bodega o no existe."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            if prod.stock < cantidad:
                return Response(
                    {'error': f"Stock insuficiente para '{prod.nombre}'. Disponibles: {prod.stock}."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            total += prod.precio * cantidad

        # 2. Registrar el pedido principal
        cliente = request.user if request.user.is_authenticated else None

        pedido = Pedido.objects.create(
            bodega=bodega,
            cliente=cliente,
            nombre_cliente=data.get('nombre_cliente', 'Cliente General'),
            telefono_cliente=data.get('telefono_cliente', ''),
            direccion_entrega=data.get('direccion_entrega', ''),
            total=total,
            estado='PENDIENTE'
        )

        # 3. Guardar detalles del pedido y descontar el inventario
        for item in items:
            prod = Producto.objects.get(id=item['id'])
            cantidad = int(item.get('cantidad', 1))
            
            DetallePedido.objects.create(
                pedido=pedido,
                producto=prod,
                cantidad=cantidad,
                precio_unitario=prod.precio
            )
            prod.stock -= cantidad
            prod.save()

        return Response(
            {
                'mensaje': 'Pedido generado exitosamente.',
                'pedido_id': pedido.id,
                'total': float(total)
            },
            status=status.HTTP_201_CREATED
        )