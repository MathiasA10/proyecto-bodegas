from decimal import Decimal
from django.db import transaction
from django.db.models import Sum, Count, F
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
            estado='PENDIENTE',
            metodo_entrega=data.get('metodo_entrega', 'RECOJO'),
            metodo_pago=data.get('metodo_pago', 'CONTRA_ENTREGA')
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

# ==========================================
# SPRINT 4: GESTIÓN DE PEDIDOS Y REPORTES
# ==========================================

# HU-13: Listar pedidos de la bodega autenticada
class BodegaPedidosListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        bodega = Bodega.objects.filter(usuario=request.user).first()
        if not bodega:
            return Response({'error': 'No tienes una bodega asociada.'}, status=status.HTTP_404_NOT_FOUND)

        pedidos = Pedido.objects.filter(bodega=bodega).order_by('-created_at')
        data = []
        for p in pedidos:
            detalles = [
                {
                    'producto': d.producto.nombre,
                    'cantidad': d.cantidad,
                    'precio_unitario': float(d.precio_unitario),
                    'subtotal': float(d.cantidad * d.precio_unitario)
                }
                for d in p.detalles.all()
            ]
            data.append({
                'id': p.id,
                'nombre_cliente': p.nombre_cliente,
                'telefono_cliente': p.telefono_cliente,
                'direccion_entrega': p.direccion_entrega,
                'total': float(p.total),
                'estado': p.estado,
                'created_at': p.created_at.strftime('%Y-%m-%d %H:%M:%S'),
                'items': detalles
            })
        return Response(data, status=status.HTTP_200_OK)


# HU-14: Cambiar estado del pedido con reglas de validación
class CambiarEstadoPedidoView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, pk):
        bodega = Bodega.objects.filter(usuario=request.user).first()
        pedido = Pedido.objects.filter(id=pk, bodega=bodega).first()
        if not pedido:
            return Response({'error': 'Pedido no encontrado o no pertenece a tu bodega.'}, status=status.HTTP_404_NOT_FOUND)

        nuevo_estado = request.data.get('estado')
        estados_validos = [choice[0] for choice in Pedido.ESTADO_CHOICES]

        if nuevo_estado not in estados_validos:
            return Response({'error': f'Estado no válido. Opciones: {estados_validos}'}, status=status.HTTP_400_BAD_REQUEST)

        # Regla de negocio: No se puede modificar un pedido ya entregado ni cancelado
        if pedido.estado in ['ENTREGADO', 'CANCELADO']:
            return Response({'error': f'No se puede modificar un pedido que ya está {pedido.estado}.'}, status=status.HTTP_400_BAD_REQUEST)

        pedido.estado = nuevo_estado
        pedido.save()

        return Response({
            'mensaje': f'Estado del pedido #{pedido.id} actualizado a {nuevo_estado}.',
            'pedido_id': pedido.id,
            'nuevo_estado': pedido.estado
        }, status=status.HTTP_200_OK)


# HU-15: Consultar seguimiento de pedido (público para el cliente con ID)
class SeguimientoPedidoView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, pk):
        pedido = Pedido.objects.filter(id=pk).first()
        if not pedido:
            return Response({'error': 'Pedido no encontrado.'}, status=status.HTTP_404_NOT_FOUND)

        repartidor = None
        if pedido.repartidor_lat and pedido.repartidor_lng:
            repartidor = {
                'latitud': float(pedido.repartidor_lat),
                'longitud': float(pedido.repartidor_lng)
            }

        return Response({
            'pedido_id': pedido.id,
            'estado': pedido.estado,
            'bodega': {
                'nombre': pedido.bodega.nombre_comercial,
                'direccion': pedido.bodega.direccion,
                'latitud': float(pedido.bodega.latitud),
                'longitud': float(pedido.bodega.longitud),
                'telefono': pedido.bodega.telefono
            },
            'direccion_entrega': pedido.direccion_entrega,
            'total': float(pedido.total),
            'created_at': pedido.created_at.strftime('%Y-%m-%d %H:%M:%S'),
            'repartidor': repartidor
        }, status=status.HTTP_200_OK)


# HU-15 Extra: Actualizar ubicación del repartidor (solo bodeguero)
class ActualizarRepartidorView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, pk):
        bodega = Bodega.objects.filter(usuario=request.user).first()
        pedido = Pedido.objects.filter(id=pk, bodega=bodega).first()
        if not pedido:
            return Response({'error': 'Pedido no encontrado o no pertenece a tu bodega.'}, status=status.HTTP_404_NOT_FOUND)

        lat = request.data.get('repartidor_lat')
        lng = request.data.get('repartidor_lng')

        if lat is None or lng is None:
            return Response({'error': 'Se requieren repartidor_lat y repartidor_lng'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            pedido.repartidor_lat = lat
            pedido.repartidor_lng = lng
            pedido.save()
            return Response({
                'mensaje': 'Ubicación del repartidor actualizada',
                'pedido_id': pedido.id,
                'repartidor_lat': float(pedido.repartidor_lat),
                'repartidor_lng': float(pedido.repartidor_lng)
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


# HU-16: Reporte de ventas para el bodeguero (Agregaciones ORM)
class ReporteVentasView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        bodega = Bodega.objects.filter(usuario=request.user).first()
        if not bodega:
            return Response({'error': 'No tienes una bodega asociada.'}, status=status.HTTP_404_NOT_FOUND)

        # Métricas principales de órdenes entregadas
        pedidos_entregados = Pedido.objects.filter(bodega=bodega, estado='ENTREGADO')
        total_ventas = pedidos_entregados.aggregate(total=Sum('total'))['total'] or Decimal('0.00')
        cantidad_pedidos = pedidos_entregados.count()

        # Top productos más vendidos
        top_productos = (
            DetallePedido.objects.filter(pedido__bodega=bodega, pedido__estado='ENTREGADO')
            .values('producto__nombre')
            .annotate(unidades_vendidas=Sum('cantidad'), total_generado=Sum(F('cantidad') * F('precio_unitario')))
            .order_by('-unidades_vendidas')[:5]
        )

        return Response({
            'total_ventas': float(total_ventas),
            'cantidad_pedidos_completados': cantidad_pedidos,
            'pedidos_totales_registrados': Pedido.objects.filter(bodega=bodega).count(),
            'top_productos': list(top_productos)
        }, status=status.HTTP_200_OK)