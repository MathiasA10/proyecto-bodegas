from rest_framework.permissions import BasePermission


class IsBodeguero(BasePermission):
    message = 'Solo los bodegueros pueden realizar esta accion.'

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.rol == 'BODEGUERO')


class IsCliente(BasePermission):
    message = 'Solo los clientes pueden realizar esta accion.'

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.rol == 'CLIENTE')
