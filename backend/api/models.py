from decimal import Decimal

from django.db import models
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.contrib.auth.models import AbstractUser

class Usuario(AbstractUser):
    # HU-01: Roles de usuario
    ROL_CHOICES = (
        ('BODEGUERO', 'Bodeguero'),
        ('CLIENTE', 'Cliente'),
    )
    email = models.EmailField(unique=True)
    dni = models.CharField(max_length=8, unique=True, null=True, blank=True)
    rol = models.CharField(max_length=15, choices=ROL_CHOICES, default='CLIENTE')

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username', 'first_name', 'last_name']

    def __str__(self):
        return f"{self.email} ({self.rol})"

class Bodega(models.Model):
    # HU-03: Perfil comercial y geolocalización
    usuario = models.OneToOneField(Usuario, on_delete=models.PROTECT, related_name='bodega')
    nombre_comercial = models.CharField(max_length=150)
    direccion = models.CharField(max_length=255)
    latitud = models.DecimalField(max_digits=10, decimal_places=8)
    longitud = models.DecimalField(max_digits=11, decimal_places=8)
    telefono = models.CharField(max_length=15, blank=True, null=True)
    abierto = models.BooleanField(default=True)
    radio_entrega_km = models.DecimalField(
        max_digits=5, decimal_places=2, default=Decimal('3.00')
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.nombre_comercial

class Categoria(models.Model):
    bodega = models.ForeignKey(Bodega, on_delete=models.CASCADE, related_name='categorias')
    nombre = models.CharField(max_length=50)
    orden = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ['orden', 'nombre']
        constraints = [
            models.UniqueConstraint(fields=['bodega', 'nombre'], name='categoria_unica_por_bodega')
        ]

    def __str__(self):
        return f"{self.nombre} ({self.bodega.nombre_comercial})"


class Producto(models.Model):
    bodega = models.ForeignKey(Bodega, on_delete=models.CASCADE, related_name='productos')
    nombre = models.CharField(max_length=150)
    descripcion = models.TextField(blank=True, null=True)
    precio = models.DecimalField(max_digits=8, decimal_places=2)
    stock = models.PositiveIntegerField(default=0)
    imagen = models.URLField(max_length=500, blank=True, null=True)
    imagen_public_id = models.CharField(max_length=200, blank=True, null=True)
    categoria = models.ForeignKey(
        Categoria, on_delete=models.PROTECT, related_name='productos'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.nombre} - S/. {self.precio}"


CATEGORIAS_INICIALES = [
    'Abarrotes',
    'Bebidas',
    'Limpieza',
    'Snacks',
    'Otros',
]


@receiver(post_save, sender=Bodega)
def crear_categorias_iniciales(sender, instance, created, **kwargs):
    if not created:
        return
    Categoria.objects.bulk_create(
        [
            Categoria(bodega=instance, nombre=nombre, orden=indice)
            for indice, nombre in enumerate(CATEGORIAS_INICIALES)
        ]
    )

class Pedido(models.Model):
    ESTADO_CHOICES = (
        ('PENDIENTE', 'Pendiente'),
        ('EN_PREPARACIÓN', 'En preparación'),
        ('EN_CAMINO', 'En camino'),
        ('LISTO_PARA_RECOGER', 'Listo para recoger'),
        ('ENTREGADO', 'Entregado'),
        ('CANCELADO', 'Cancelado'),
    )
    METODO_ENTREGA_CHOICES = (
        ('RECOJO', 'Recojo en tienda'),
        ('DELIVERY', 'Despacho a domicilio'),
    )
    METODO_PAGO_CHOICES = (
        ('YAPE', 'Yape'),
        ('PLIN', 'Plin'),
        ('CONTRA_ENTREGA', 'Contra entrega'),
    )
    bodega = models.ForeignKey(Bodega, on_delete=models.PROTECT, related_name='pedidos')
    cliente = models.ForeignKey(Usuario, on_delete=models.SET_NULL, related_name='pedidos_cliente', null=True, blank=True)
    nombre_cliente = models.CharField(max_length=150)
    telefono_cliente = models.CharField(max_length=15)
    direccion_entrega = models.CharField(max_length=255)
    cliente_lat = models.DecimalField(max_digits=10, decimal_places=8, null=True, blank=True)
    cliente_lng = models.DecimalField(max_digits=11, decimal_places=8, null=True, blank=True)
    distancia_km = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    total = models.DecimalField(max_digits=10, decimal_places=2, default=0.0)
    estado = models.CharField(max_length=25, choices=ESTADO_CHOICES, default='PENDIENTE')
    metodo_entrega = models.CharField(max_length=15, choices=METODO_ENTREGA_CHOICES, default='RECOJO')
    metodo_pago = models.CharField(max_length=15, choices=METODO_PAGO_CHOICES, default='CONTRA_ENTREGA')
    repartidor_lat = models.DecimalField(max_digits=10, decimal_places=8, null=True, blank=True)
    repartidor_lng = models.DecimalField(max_digits=11, decimal_places=8, null=True, blank=True)
    idempotency_key = models.CharField(max_length=64, blank=True, null=True)
    idempotency_hash = models.CharField(max_length=64, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['cliente', 'idempotency_key'],
                condition=models.Q(idempotency_key__isnull=False),
                name='pedido_idempotencia_unica_por_cliente',
            )
        ]

    def __str__(self):
        return f"Pedido #{self.id} - {self.nombre_cliente} (S/. {self.total})"

class DetallePedido(models.Model):
    pedido = models.ForeignKey(Pedido, on_delete=models.CASCADE, related_name='detalles')
    producto = models.ForeignKey(
        Producto, on_delete=models.SET_NULL, null=True, blank=True
    )
    producto_nombre = models.CharField(max_length=150, blank=True, null=True)
    cantidad = models.PositiveIntegerField(default=1)
    precio_unitario = models.DecimalField(max_digits=8, decimal_places=2)

    def __str__(self):
        nombre = self.producto_nombre or (
            self.producto.nombre if self.producto else 'Producto eliminado'
        )
        return f"{self.cantidad}x {nombre}"


class PasswordResetOTP(models.Model):
    usuario = models.ForeignKey(
        Usuario, on_delete=models.CASCADE, related_name='password_reset_otps'
    )
    codigo_hash = models.CharField(max_length=128)
    expira_en = models.DateTimeField()
    usado = models.BooleanField(default=False)
    intentos = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"OTP de {self.usuario.email} ({'usado' if self.usado else 'activo'})"