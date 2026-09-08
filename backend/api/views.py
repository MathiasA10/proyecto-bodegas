from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from .models import Usuario, Bodega, Producto
from .serializers import RegistroUsuarioSerializer, BodegaSerializer, ProductoSerializer

# Token personalizado que devuelve el rol y nombre (HU-02)
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

# HU-03: Registrar y Consultar Perfil de Bodega
class BodegaDetailView(generics.CreateAPIView, generics.RetrieveUpdateAPIView):
    serializer_class = BodegaSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return Bodega.objects.filter(usuario=self.request.user).first()

    def perform_create(self, serializer):
        serializer.save(usuario=self.request.user)

# HU-04: Listar y Crear Productos de la Bodega Autenticada
class ProductoListCreateView(generics.ListCreateAPIView):
    serializer_class = ProductoSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Producto.objects.filter(bodega__usuario=self.request.user)

    def perform_create(self, serializer):
        bodega = Bodega.objects.get(usuario=self.request.user)
        serializer.save(bodega=bodega)