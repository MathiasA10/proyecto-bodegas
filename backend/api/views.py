import hashlib
import json
import logging
import math
import re
from decimal import Decimal

import cloudinary.uploader
from django.db import IntegrityError, transaction
from django.db.models import Sum, Count, F
from rest_framework import generics, permissions, status
from rest_framework.exceptions import ValidationError
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import Usuario, Bodega, Categoria, Producto, Pedido, DetallePedido
from .serializers import (
    RegistroUsuarioSerializer,
    BodegaSerializer,
    CategoriaSerializer,
    ProductoSerializer,
    BodegaMapaSerializer,
    BodegaCatalogoSerializer,
)
from .authentication import OptionalJWTAuthentication
from .auth_cookies import set_refresh_cookie
from .pagination import StandardResultsSetPagination
from .permissions import IsBodeguero, IsCliente
from .utils.geo import haversine_km

TELEFONO_PERU_RE = re.compile(r'^9\d{8}$')
logger = logging.getLogger(__name__)


def serializar_pedido(pedido):
    detalles = [
        {
            'producto': detalle.producto_nombre or (
                detalle.producto.nombre
                if detalle.producto
                else 'Producto eliminado'
            ),
            'cantidad': detalle.cantidad,
            'precio_unitario': float(detalle.precio_unitario),
            'subtotal': float(detalle.cantidad * detalle.precio_unitario),
        }
        for detalle in pedido.detalles.all()
    ]
    return {
        'id': pedido.id,
        'bodega': {
            'id': pedido.bodega_id,
            'nombre': pedido.bodega.nombre_comercial,
            'direccion': pedido.bodega.direccion,
        },
        'cliente_id': pedido.cliente_id,
        'nombre_cliente': pedido.nombre_cliente,
        'telefono_cliente': pedido.telefono_cliente,
        'direccion_entrega': pedido.direccion_entrega,
        'cliente_lat': float(pedido.cliente_lat) if pedido.cliente_lat is not None else None,
        'cliente_lng': float(pedido.cliente_lng) if pedido.cliente_lng is not None else None,
        'total': float(pedido.total),
        'estado': pedido.estado,
        'metodo_entrega': pedido.metodo_entrega,
        'metodo_pago': pedido.metodo_pago,
        'distancia_km': float(pedido.distancia_km) if pedido.distancia_km is not None else None,
        'created_at': pedido.created_at.strftime('%Y-%m-%d %H:%M:%S'),
        'items': detalles,
    }

# ==========================================
# SPRINT 1: AUTENTICACIÓN Y GESTIÓN BODEGA
# ==========================================

# HU-02: Token personalizado con rol y datos de sesión
class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)
        data['id'] = self.user.id
        data['rol'] = self.user.rol
        data['nombre'] = self.user.first_name
        data['username'] = self.user.username
        data['email'] = self.user.email
        return data

class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'login'

    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        refresh = response.data.pop('refresh', None)
        if refresh:
            set_refresh_cookie(response, refresh)
        return response

# HU-01: Registro Bodeguero
class RegistroBodegueroView(generics.CreateAPIView):
    queryset = Usuario.objects.all()
    serializer_class = RegistroUsuarioSerializer
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'registro'

# HU-03: Registrar y Consultar Perfil de Bodega (GET / POST idempotente)
class BodegaDetailView(generics.GenericAPIView):
    serializer_class = BodegaSerializer
    permission_classes = [permissions.IsAuthenticated, IsBodeguero]

    def get(self, request, *args, **kwargs):
        bodega = Bodega.objects.filter(usuario=request.user).first()
        if not bodega:
            return Response({}, status=status.HTTP_200_OK)
        serializer = self.get_serializer(bodega)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request, *args, **kwargs):
        bodega = Bodega.objects.filter(usuario=request.user).first()
        data = request.data.copy()

        if bodega:
            serializer = self.get_serializer(bodega, data=data, partial=True)
        else:
            serializer = self.get_serializer(data=data)

        if serializer.is_valid():
            serializer.save(usuario=request.user)
            return Response(
                serializer.data,
                status=status.HTTP_200_OK if bodega else status.HTTP_201_CREATED
            )
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

# HU-04: Listar y Crear Productos de la Bodega Autenticada
class ProductoListCreateView(generics.ListCreateAPIView):
    serializer_class = ProductoSerializer
    permission_classes = [permissions.IsAuthenticated, IsBodeguero]

    def get_queryset(self):
        return Producto.objects.filter(bodega__usuario=self.request.user)

    def perform_create(self, serializer):
        bodega = Bodega.objects.filter(usuario=self.request.user).first()
        if not bodega:
            raise ValidationError(
                {"detail": "Primero debes configurar el perfil y ubicación de tu bodega."}
            )
        serializer.save(bodega=bodega)


# HU-04: Editar y eliminar productos de la propia bodega
class ProductoDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = ProductoSerializer
    permission_classes = [permissions.IsAuthenticated, IsBodeguero]

    def get_queryset(self):
        return Producto.objects.filter(bodega__usuario=self.request.user)

    def perform_destroy(self, instance):
        if instance.imagen_public_id:
            try:
                cloudinary.uploader.destroy(
                    instance.imagen_public_id, resource_type='image'
                )
            except Exception:
                logger.exception(
                    'No se pudo eliminar la imagen %s de Cloudinary.',
                    instance.imagen_public_id,
                )
        instance.delete()


class CategoriaListCreateView(generics.ListCreateAPIView):
    serializer_class = CategoriaSerializer
    permission_classes = [permissions.IsAuthenticated, IsBodeguero]

    def get_queryset(self):
        return Categoria.objects.filter(bodega__usuario=self.request.user)

    def perform_create(self, serializer):
        bodega = Bodega.objects.filter(usuario=self.request.user).first()
        if not bodega:
            raise ValidationError(
                {'detail': 'Primero debes configurar el perfil de tu bodega.'}
            )
        serializer.save(bodega=bodega)


class CategoriaDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = CategoriaSerializer
    permission_classes = [permissions.IsAuthenticated, IsBodeguero]

    def get_queryset(self):
        return Categoria.objects.filter(bodega__usuario=self.request.user)

    def perform_destroy(self, instance):
        if instance.productos.exists():
            raise ValidationError(
                {'detail': 'No puedes eliminar una categoría que tiene productos.'}
            )
        instance.delete()


# ==========================================
# SPRINT 2: VISTA CLIENTE, MAPA Y PEDIDOS
# ==========================================

# Endpoint público: bodegas abiertas dentro del radio de entrega del cliente
class BodegasPublicasListView(generics.ListAPIView):
    serializer_class = BodegaMapaSerializer
    permission_classes = [permissions.AllowAny]
    authentication_classes = [OptionalJWTAuthentication]

    def get_queryset(self):
        bodegas = Bodega.objects.filter(abierto=True).annotate(
            productos_count=Count('productos')
        )

        lat = self.request.query_params.get('lat')
        lng = self.request.query_params.get('lng')

        if lat in (None, '') or lng in (None, ''):
            return bodegas.order_by('nombre_comercial')

        try:
            lat_cliente = float(lat)
            lng_cliente = float(lng)
        except (TypeError, ValueError):
            return bodegas.none()

        cercanas = []
        for bodega in bodegas:
            distancia = haversine_km(
                lat_cliente, lng_cliente, bodega.latitud, bodega.longitud
            )
            if distancia is not None and distancia <= float(bodega.radio_entrega_km):
                bodega.distancia_km = distancia
                cercanas.append(bodega)

        cercanas.sort(key=lambda item: item.distancia_km)
        return cercanas


# Endpoint público: detalle de una tienda con su catálogo
class BodegaPublicaDetailView(generics.RetrieveAPIView):
    queryset = Bodega.objects.prefetch_related('productos__categoria', 'categorias').all()
    serializer_class = BodegaCatalogoSerializer
    permission_classes = [permissions.AllowAny]
    authentication_classes = [OptionalJWTAuthentication]

# Endpoint para procesar el pedido del cliente y descontar stock transaccional
class CrearPedidoView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsCliente]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'pedido_create'

    @transaction.atomic
    def post(self, request):
        data = request.data
        idempotency_key = str(
            request.headers.get('Idempotency-Key')
            or data.get('idempotency_key')
            or ''
        ).strip() or None
        if idempotency_key and len(idempotency_key) > 64:
            return Response(
                {'error': 'La clave de idempotencia es demasiado larga.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        idempotency_hash = hashlib.sha256(
            json.dumps(data, sort_keys=True, default=str).encode('utf-8')
        ).hexdigest()

        if idempotency_key:
            existente = Pedido.objects.filter(
                cliente=request.user,
                idempotency_key=idempotency_key,
            ).first()
            if existente:
                if existente.idempotency_hash != idempotency_hash:
                    return Response(
                        {'error': 'La clave de idempotencia ya fue usada con otro pedido.'},
                        status=status.HTTP_409_CONFLICT,
                    )
                return Response(
                    {
                        'mensaje': 'Pedido ya procesado.',
                        'pedido_id': existente.id,
                        'total': float(existente.total),
                        'distancia_km': float(existente.distancia_km)
                        if existente.distancia_km is not None
                        else None,
                    },
                    status=status.HTTP_200_OK,
                )

        items = data.get('items', [])

        if not isinstance(items, list) or not items:
            return Response(
                {'error': 'El carrito no contiene productos.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        if len(items) > 50:
            return Response(
                {'error': 'El pedido supera el máximo de 50 líneas.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        nombre_cliente = str(data.get('nombre_cliente', '')).strip()
        if not nombre_cliente:
            return Response(
                {'error': 'El nombre del cliente es obligatorio.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        if len(nombre_cliente) > 150:
            return Response(
                {'error': 'El nombre del cliente es demasiado largo.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        telefono_cliente = str(data.get('telefono_cliente', '')).strip()
        if not TELEFONO_PERU_RE.match(telefono_cliente):
            return Response(
                {'error': 'Ingresa un teléfono válido de 9 dígitos que empiece con 9.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            bodega_id = int(data.get('bodega_id'))
        except (TypeError, ValueError):
            return Response(
                {'error': 'La bodega indicada no es válida.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        bodega = Bodega.objects.filter(id=bodega_id).first()
        if not bodega:
            return Response(
                {'error': 'Bodega no encontrada.'},
                status=status.HTTP_404_NOT_FOUND
            )

        if not bodega.abierto:
            return Response(
                {'error': 'La bodega está cerrada en este momento.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        metodo_entrega = str(data.get('metodo_entrega', 'RECOJO')).strip()
        if metodo_entrega not in dict(Pedido.METODO_ENTREGA_CHOICES):
            return Response(
                {'error': 'Método de entrega no válido.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        metodo_pago = str(data.get('metodo_pago', 'CONTRA_ENTREGA')).strip()
        if metodo_pago not in dict(Pedido.METODO_PAGO_CHOICES):
            return Response(
                {'error': 'Método de pago no válido.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        direccion_entrega = str(data.get('direccion_entrega', '')).strip()
        if len(direccion_entrega) > 255:
            return Response(
                {'error': 'La dirección de entrega es demasiado larga.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        if metodo_entrega == 'DELIVERY' and not direccion_entrega:
            return Response(
                {'error': 'La dirección de entrega es obligatoria para delivery.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        cliente_lat_raw = data.get('cliente_lat')
        cliente_lng_raw = data.get('cliente_lng')
        cliente_coords = None

        if cliente_lat_raw not in (None, '') or cliente_lng_raw not in (None, ''):
            try:
                latitud_cliente = float(cliente_lat_raw)
                longitud_cliente = float(cliente_lng_raw)
            except (TypeError, ValueError):
                return Response(
                    {'error': 'Las coordenadas del cliente no son válidas.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            if not (
                math.isfinite(latitud_cliente)
                and math.isfinite(longitud_cliente)
                and -90 <= latitud_cliente <= 90
                and -180 <= longitud_cliente <= 180
            ):
                return Response(
                    {'error': 'Las coordenadas del cliente están fuera de rango.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            cliente_coords = (latitud_cliente, longitud_cliente)

        if metodo_entrega == 'DELIVERY' and not cliente_coords:
            return Response(
                {'error': 'Debes indicar la ubicación de entrega en el mapa.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        distancia = None
        if metodo_entrega == 'DELIVERY':
            distancia = haversine_km(
                cliente_coords[0], cliente_coords[1], bodega.latitud, bodega.longitud
            )
            if distancia is None:
                return Response(
                    {'error': 'No se pudo calcular la distancia de entrega.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            if distancia > float(bodega.radio_entrega_km):
                return Response(
                    {'error': f'La ubicación está fuera del radio de entrega de la bodega ({bodega.radio_entrega_km} km).'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        # 1. Normalizar y validar cantidades (agrupando productos repetidos)
        cantidades = {}
        for item in items:
            if not isinstance(item, dict):
                return Response(
                    {'error': 'Formato de producto no válido.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            try:
                producto_id = int(item.get('id'))
                cantidad = int(item.get('cantidad', 1))
            except (TypeError, ValueError):
                return Response(
                    {'error': 'El producto o la cantidad no son válidos.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            if cantidad <= 0 or cantidad > 1000:
                return Response(
                    {'error': 'La cantidad de cada producto debe estar entre 1 y 1000.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            cantidades[producto_id] = cantidades.get(producto_id, 0) + cantidad

        # 2. Validar stock y calcular el total solo con precios de la base de datos
        productos = {}
        total = Decimal('0.00')

        productos_qs = (
            Producto.objects.select_for_update()
            .filter(id__in=sorted(cantidades), bodega=bodega)
            .order_by('id')
        )
        for prod in productos_qs:
            productos[prod.id] = prod

        for producto_id, cantidad in cantidades.items():
            prod = productos.get(producto_id)
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

        # 3. Registrar el pedido principal
        try:
            with transaction.atomic():
                pedido = Pedido.objects.create(
                    bodega=bodega,
                    cliente=request.user,
                    nombre_cliente=nombre_cliente,
                    telefono_cliente=telefono_cliente,
                    direccion_entrega=direccion_entrega,
                    cliente_lat=Decimal(str(cliente_coords[0])) if cliente_coords else None,
                    cliente_lng=Decimal(str(cliente_coords[1])) if cliente_coords else None,
                    distancia_km=Decimal(str(round(distancia, 2))) if distancia is not None else None,
                    total=total,
                    estado='PENDIENTE',
                    metodo_entrega=metodo_entrega,
                    metodo_pago=metodo_pago,
                    idempotency_key=idempotency_key,
                    idempotency_hash=idempotency_hash,
                )
        except IntegrityError:
            if idempotency_key:
                existente = Pedido.objects.filter(
                    cliente=request.user,
                    idempotency_key=idempotency_key,
                ).first()
                if existente and existente.idempotency_hash == idempotency_hash:
                    return Response(
                        {
                            'mensaje': 'Pedido ya procesado.',
                            'pedido_id': existente.id,
                            'total': float(existente.total),
                            'distancia_km': float(existente.distancia_km)
                            if existente.distancia_km is not None
                            else None,
                        },
                        status=status.HTTP_200_OK,
                    )
            raise

        # 4. Guardar detalles del pedido y descontar el inventario
        for producto_id, cantidad in cantidades.items():
            prod = productos[producto_id]

            DetallePedido.objects.create(
                pedido=pedido,
                producto=prod,
                producto_nombre=prod.nombre,
                cantidad=cantidad,
                precio_unitario=prod.precio
            )
            prod.stock -= cantidad
            prod.save(update_fields=['stock'])

        return Response(
            {
                'mensaje': 'Pedido generado exitosamente.',
                'pedido_id': pedido.id,
                'total': float(total),
                'distancia_km': round(distancia, 2) if distancia is not None else None,
            },
            status=status.HTTP_201_CREATED
        )

# ==========================================
# SPRINT 4: GESTIÓN DE PEDIDOS Y REPORTES
# ==========================================

# HU-13: Listar pedidos de la bodega autenticada
class BodegaPedidosListView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsBodeguero]

    def get(self, request):
        bodega = Bodega.objects.filter(usuario=request.user).first()
        if not bodega:
            return Response({'error': 'No tienes una bodega asociada.'}, status=status.HTTP_404_NOT_FOUND)

        pedidos = (
            Pedido.objects.filter(bodega=bodega)
            .select_related('bodega', 'cliente')
            .prefetch_related('detalles__producto')
            .order_by('-created_at')
        )
        paginador = StandardResultsSetPagination()
        pagina = paginador.paginate_queryset(pedidos, request)
        serializados = [serializar_pedido(pedido) for pedido in pagina]
        return paginador.get_paginated_response(serializados)


class MisPedidosView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsCliente]

    def get(self, request):
        pedidos = (
            Pedido.objects.filter(cliente=request.user)
            .select_related('bodega')
            .prefetch_related('detalles__producto')
            .order_by('-created_at')
        )
        paginador = StandardResultsSetPagination()
        pagina = paginador.paginate_queryset(pedidos, request)
        serializados = [serializar_pedido(pedido) for pedido in pagina]
        return paginador.get_paginated_response(serializados)


# HU-14: Cambiar estado del pedido con reglas de validación
class CambiarEstadoPedidoView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsBodeguero]

    TRANSICIONES_DELIVERY = {
        'PENDIENTE': ['EN_PREPARACIÓN', 'CANCELADO'],
        'EN_PREPARACIÓN': ['EN_CAMINO', 'CANCELADO'],
        'EN_CAMINO': ['ENTREGADO', 'CANCELADO'],
        'ENTREGADO': [],
        'CANCELADO': [],
    }

    TRANSICIONES_RECOJO = {
        'PENDIENTE': ['EN_PREPARACIÓN', 'CANCELADO'],
        'EN_PREPARACIÓN': ['LISTO_PARA_RECOGER', 'CANCELADO'],
        'LISTO_PARA_RECOGER': ['ENTREGADO', 'CANCELADO'],
        'ENTREGADO': [],
        'CANCELADO': [],
    }

    def _transiciones_de(self, pedido):
        if pedido.metodo_entrega == 'RECOJO':
            return self.TRANSICIONES_RECOJO
        return self.TRANSICIONES_DELIVERY

    @transaction.atomic
    def patch(self, request, pk):
        bodega = Bodega.objects.filter(usuario=request.user).first()
        pedido = Pedido.objects.select_for_update().filter(id=pk, bodega=bodega).first()
        if not pedido:
            return Response({'error': 'Pedido no encontrado o no pertenece a tu bodega.'}, status=status.HTTP_404_NOT_FOUND)

        nuevo_estado = request.data.get('estado')
        estados_validos = [choice[0] for choice in Pedido.ESTADO_CHOICES]

        if nuevo_estado not in estados_validos:
            return Response({'error': f'Estado no válido. Opciones: {estados_validos}'}, status=status.HTTP_400_BAD_REQUEST)

        # Regla de negocio: No se puede modificar un pedido ya entregado ni cancelado
        if pedido.estado in ['ENTREGADO', 'CANCELADO']:
            return Response({'error': f'No se puede modificar un pedido que ya está {pedido.estado}.'}, status=status.HTTP_400_BAD_REQUEST)

        transiciones = self._transiciones_de(pedido).get(pedido.estado, [])
        if nuevo_estado not in transiciones:
            return Response(
                {'error': f'Transición no permitida: {pedido.estado} -> {nuevo_estado}.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Al cancelar, devolver las unidades al inventario
        if nuevo_estado == 'CANCELADO':
            for detalle in pedido.detalles.all():
                Producto.objects.filter(id=detalle.producto_id).update(
                    stock=F('stock') + detalle.cantidad
                )

        pedido.estado = nuevo_estado
        pedido.save(update_fields=['estado'])

        return Response({
            'mensaje': f'Estado del pedido #{pedido.id} actualizado a {nuevo_estado}.',
            'pedido_id': pedido.id,
            'nuevo_estado': pedido.estado
        }, status=status.HTTP_200_OK)


class SeguimientoPedidoView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        pedido = (
            Pedido.objects.select_related('bodega', 'cliente')
            .prefetch_related('detalles__producto')
            .filter(id=pk)
            .first()
        )
        if not pedido:
            return Response({'error': 'Pedido no encontrado.'}, status=status.HTTP_404_NOT_FOUND)

        es_dueno = pedido.cliente_id == request.user.id
        es_bodeguero = (
            pedido.bodega.usuario_id == request.user.id
            and request.user.rol == 'BODEGUERO'
        )
        if not (es_dueno or es_bodeguero):
            return Response(
                {'error': 'No tienes permiso para ver este pedido.'},
                status=status.HTTP_403_FORBIDDEN,
            )

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
            'cliente_lat': float(pedido.cliente_lat) if pedido.cliente_lat is not None else None,
            'cliente_lng': float(pedido.cliente_lng) if pedido.cliente_lng is not None else None,
            'direccion_entrega': pedido.direccion_entrega,
            'metodo_entrega': pedido.metodo_entrega,
            'metodo_pago': pedido.metodo_pago,
            'distancia_km': float(pedido.distancia_km) if pedido.distancia_km is not None else None,
            'total': float(pedido.total),
            'created_at': pedido.created_at.strftime('%Y-%m-%d %H:%M:%S'),
            'items': [
                {
                    'producto': detalle.producto_nombre or (
                        detalle.producto.nombre
                        if detalle.producto
                        else 'Producto eliminado'
                    ),
                    'cantidad': detalle.cantidad,
                    'precio_unitario': float(detalle.precio_unitario),
                }
                for detalle in pedido.detalles.all()
            ],
            'repartidor': repartidor
        }, status=status.HTTP_200_OK)


# HU-15 Extra: Actualizar ubicación del repartidor (solo bodeguero)
class ActualizarRepartidorView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsBodeguero]

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
    permission_classes = [permissions.IsAuthenticated, IsBodeguero]

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
            .values('producto_nombre')
            .annotate(unidades_vendidas=Sum('cantidad'), total_generado=Sum(F('cantidad') * F('precio_unitario')))
            .order_by('-unidades_vendidas')[:5]
        )

        return Response({
            'total_ventas': float(total_ventas),
            'cantidad_pedidos_completados': cantidad_pedidos,
            'pedidos_totales_registrados': Pedido.objects.filter(bodega=bodega).count(),
            'top_productos': list(top_productos)
        }, status=status.HTTP_200_OK)