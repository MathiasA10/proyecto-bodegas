from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import AuthenticationFailed, InvalidToken


class OptionalJWTAuthentication(JWTAuthentication):
    """Autentica si el token es valido, pero permite continuar como anonimo si no lo es.

    Se usa en endpoints publicos para que un token vencido o corrupto no bloquee
    el registro, el mapa o el seguimiento de pedidos.
    """

    def authenticate(self, request):
        try:
            return super().authenticate(request)
        except (AuthenticationFailed, InvalidToken):
            return None
