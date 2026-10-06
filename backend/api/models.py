from django.db import models
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
    usuario = models.OneToOneField(Usuario, on_delete=models.CASCADE, related_name='bodega')
    nombre_comercial = models.CharField(max_length=150)
    direccion = models.CharField(max_length=255)
    latitud = models.DecimalField(max_digits=10, decimal_places=8)
    longitud = models.DecimalField(max_digits=11, decimal_places=8)
    telefono = models.CharField(max_length=15, blank=True, null=True)
    abierto = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.nombre_comercial

class Producto(models.Model):
    # HU-04: Catálogo de productos
    bodega = models.ForeignKey(Bodega, on_delete=models.CASCADE, related_name='productos')
    nombre = models.CharField(max_length=150)
    descripcion = models.TextField(blank=True, null=True)
    precio = models.DecimalField(max_digits=8, decimal_places=2)
    stock = models.PositiveIntegerField(default=0)
    imagen = models.ImageField(upload_to='productos/', blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.nombre} - S/. {self.precio}"

class Pedido(models.Model):
    ESTADO_CHOICES = (
        ('PENDIENTE', 'Pendiente'),
        ('EN_PREPARACIÓN', 'En preparación'),
        ('EN_CAMINO', 'En camino'),
        ('ENTREGADO', 'Entregado'),
        ('CANCELADO', 'Cancelado'),
    )
    bodega = models.ForeignKey(Bodega, on_delete=models.CASCADE, related_name='pedidos')
    cliente = models.ForeignKey(Usuario, on_delete=models.CASCADE, related_name='pedidos_cliente', null=True, blank=True)
    nombre_cliente = models.CharField(max_length=150)
    telefono_cliente = models.CharField(max_length=15)
    direccion_entrega = models.CharField(max_length=255)
    total = models.DecimalField(max_digits=10, decimal_places=2, default=0.0)
    estado = models.CharField(max_length=15, choices=ESTADO_CHOICES, default='PENDIENTE')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Pedido #{self.id} - {self.nombre_cliente} (S/. {self.total})"

class DetallePedido(models.Model):
    pedido = models.ForeignKey(Pedido, on_delete=models.CASCADE, related_name='detalles')
    producto = models.ForeignKey(Producto, on_delete=models.CASCADE)
    cantidad = models.PositiveIntegerField(default=1)
    precio_unitario = models.DecimalField(max_digits=8, decimal_places=2)

    def __str__(self):
        return f"{self.cantidad}x {self.producto.nombre}"