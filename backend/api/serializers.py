from rest_framework import serializers
from .models import Usuario, Bodega, Producto, Pedido, DetallePedido

class RegistroUsuarioSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6)

    class Meta:
        model = Usuario
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'dni', 'rol', 'password']
        extra_kwargs = {
            'first_name': {'required': False, 'allow_blank': True},
            'last_name': {'required': False, 'allow_blank': True},
            'dni': {'required': False, 'allow_blank': True},
            'rol': {'required': False},
        }

    def create(self, validated_data):
        password = validated_data.pop('password')
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

class ProductoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Producto
        fields = '__all__'
        read_only_fields = ['bodega']

class DetallePedidoSerializer(serializers.ModelSerializer):
    producto_nombre = serializers.ReadOnlyField(source='producto.nombre')

    class Meta:
        model = DetallePedido
        fields = ['id', 'producto', 'producto_nombre', 'cantidad', 'precio_unitario']

class PedidoSerializer(serializers.ModelSerializer):
    detalles = DetallePedidoSerializer(many=True, read_only=True)

    class Meta:
        model = Pedido
        fields = '__all__'

# Serializador para el mapa público del cliente (HU Sprint 2)
class BodegaPublicaSerializer(serializers.ModelSerializer):
    productos = serializers.SerializerMethodField()
    latitud = serializers.FloatField()
    longitud = serializers.FloatField()

    class Meta:
        model = Bodega
        fields = ['id', 'nombre_comercial', 'direccion', 'latitud', 'longitud', 'telefono', 'abierto', 'productos']

    def get_productos(self, obj):
        # Consulta directa y segura de los productos asociados a la bodega
        prods = Producto.objects.filter(bodega=obj)
        return ProductoSerializer(prods, many=True).data