import logging
import re

import cloudinary.uploader
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from .models import (
    Usuario,
    Bodega,
    Categoria,
    Producto,
    Pedido,
    DetallePedido,
)

TELEFONO_PERU_RE = re.compile(r'^9\d{8}$')
logger = logging.getLogger(__name__)

TAMANO_MAXIMO_IMAGEN = 5 * 1024 * 1024
FORMATOS_PERMITIDOS = {'image/jpeg', 'image/png', 'image/webp'}


class RegistroUsuarioSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = Usuario
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'dni', 'rol', 'password']
        extra_kwargs = {
            'first_name': {'required': False, 'allow_blank': True},
            'last_name': {'required': False, 'allow_blank': True},
            'dni': {'required': False, 'allow_blank': True},
            'rol': {'required': False},
        }

    def validate_password(self, value):
        usuario = Usuario(
            username=self.initial_data.get('username', ''),
            email=self.initial_data.get('email', ''),
            first_name=self.initial_data.get('first_name', ''),
            last_name=self.initial_data.get('last_name', ''),
        )
        try:
            validate_password(value, usuario)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(list(exc.messages)) from exc
        return value

    def create(self, validated_data):
        password = validated_data.pop('password')
        # Convertir DNI vacío a None para evitar conflicto unique constraint
        if validated_data.get('dni') == '':
            validated_data['dni'] = None

        if 'rol' not in validated_data or not validated_data['rol']:
            validated_data['rol'] = 'BODEGUERO'

        user = Usuario(**validated_data)
        user.set_password(password)
        user.save()
        return user


class BodegaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Bodega
        fields = '__all__'
        read_only_fields = ['usuario']

    def validate_telefono(self, value):
        if value in (None, ''):
            return value
        if not TELEFONO_PERU_RE.match(value):
            raise serializers.ValidationError(
                'Ingresa un teléfono válido de 9 dígitos que empiece con 9.'
            )
        return value


class CategoriaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Categoria
        fields = ['id', 'nombre', 'orden']
        read_only_fields = ['id']

    def validate_nombre(self, value):
        nombre = value.strip()
        if not nombre:
            raise serializers.ValidationError('El nombre de la categoría es obligatorio.')
        return nombre


class ProductoSerializer(serializers.ModelSerializer):
    categoria_nombre = serializers.CharField(source='categoria.nombre', read_only=True)
    imagen_file = serializers.ImageField(write_only=True, required=False, allow_null=True)

    class Meta:
        model = Producto
        fields = [
            'id', 'bodega', 'nombre', 'descripcion', 'precio', 'stock',
            'imagen', 'imagen_public_id', 'imagen_file', 'categoria',
            'categoria_nombre', 'created_at',
        ]
        read_only_fields = ['bodega', 'imagen', 'imagen_public_id']

    def _bodega(self):
        instance = getattr(self, 'instance', None)
        if instance is not None:
            return instance.bodega
        usuario = self.context['request'].user
        return Bodega.objects.filter(usuario=usuario).first()

    def validate_categoria(self, value):
        bodega = self._bodega()
        if bodega is None or value.bodega_id != bodega.id:
            raise serializers.ValidationError(
                'La categoría no pertenece a tu bodega.'
            )
        return value

    def validate_imagen_file(self, value):
        if value.size > TAMANO_MAXIMO_IMAGEN:
            raise serializers.ValidationError(
                'La imagen no puede superar los 5 MB.'
            )
        if value.content_type not in FORMATOS_PERMITIDOS:
            raise serializers.ValidationError(
                'La imagen debe ser JPG, PNG o WebP.'
            )
        return value

    def _subir_imagen(self, archivo, bodega_id):
        try:
            resultado = cloudinary.uploader.upload(
                archivo,
                folder=f'bodegas/{bodega_id}/productos',
                resource_type='image',
                allowed_formats=['jpg', 'png', 'webp'],
            )
        except Exception as exc:
            raise serializers.ValidationError(
                'No se pudo subir la imagen a Cloudinary.'
            ) from exc
        return resultado['secure_url'], resultado['public_id']

    def _eliminar_imagen(self, public_id):
        if not public_id:
            return
        try:
            cloudinary.uploader.destroy(public_id, resource_type='image')
        except Exception:
            logger.exception(
                'No se pudo eliminar la imagen %s de Cloudinary.', public_id
            )

    def create(self, validated_data):
        archivo = validated_data.pop('imagen_file', None)
        producto = super().create(validated_data)
        if archivo:
            try:
                url, public_id = self._subir_imagen(archivo, producto.bodega_id)
            except serializers.ValidationError:
                producto.delete()
                raise
            producto.imagen = url
            producto.imagen_public_id = public_id
            producto.save(update_fields=['imagen', 'imagen_public_id'])
        return producto

    def update(self, instance, validated_data):
        archivo = validated_data.pop('imagen_file', None)
        if archivo:
            url, public_id = self._subir_imagen(archivo, instance.bodega_id)
            self._eliminar_imagen(instance.imagen_public_id)
            validated_data['imagen'] = url
            validated_data['imagen_public_id'] = public_id
        return super().update(instance, validated_data)


class DetallePedidoSerializer(serializers.ModelSerializer):
    producto_nombre = serializers.CharField(read_only=True)

    class Meta:
        model = DetallePedido
        fields = ['id', 'producto', 'producto_nombre', 'cantidad', 'precio_unitario']


class PedidoSerializer(serializers.ModelSerializer):
    detalles = DetallePedidoSerializer(many=True, read_only=True)

    class Meta:
        model = Pedido
        fields = '__all__'


class BodegaMapaSerializer(serializers.ModelSerializer):
    latitud = serializers.FloatField()
    longitud = serializers.FloatField()
    radio_entrega_km = serializers.FloatField()
    productos_count = serializers.IntegerField(read_only=True)
    distancia_km = serializers.SerializerMethodField()

    class Meta:
        model = Bodega
        fields = [
            'id', 'nombre_comercial', 'direccion', 'latitud', 'longitud',
            'telefono', 'abierto', 'radio_entrega_km', 'productos_count', 'distancia_km',
        ]

    def get_distancia_km(self, obj):
        distancia = getattr(obj, 'distancia_km', None)
        return round(distancia, 2) if distancia is not None else None


class ProductoPublicoSerializer(serializers.ModelSerializer):
    categoria_nombre = serializers.CharField(source='categoria.nombre', read_only=True)

    class Meta:
        model = Producto
        fields = [
            'id', 'nombre', 'descripcion', 'precio', 'stock', 'imagen',
            'categoria', 'categoria_nombre',
        ]


class BodegaCatalogoSerializer(serializers.ModelSerializer):
    latitud = serializers.FloatField()
    longitud = serializers.FloatField()
    radio_entrega_km = serializers.FloatField()
    productos = ProductoPublicoSerializer(many=True, read_only=True)
    categorias = CategoriaSerializer(many=True, read_only=True)

    class Meta:
        model = Bodega
        fields = [
            'id', 'nombre_comercial', 'direccion', 'latitud', 'longitud',
            'telefono', 'abierto', 'radio_entrega_km', 'productos', 'categorias',
        ]
