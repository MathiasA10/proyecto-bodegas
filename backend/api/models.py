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