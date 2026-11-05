import logging
import secrets
from datetime import timedelta

from django.conf import settings
from django.contrib.auth.hashers import check_password, make_password
from django.core import signing
from django.core.mail import send_mail
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import PasswordResetOTP, Usuario

logger = logging.getLogger(__name__)

RESET_SALT = 'bodegas.password-reset'
OTP_TTL_MINUTOS = 10
RESET_TOKEN_MAX_AGE = 900
MAX_INTENTOS = 5
MAX_SOLICITUDES_15_MIN = 3

RESPUESTA_GENERICA = {
    'mensaje': 'Si el correo está registrado, recibirás un código de verificación.'
}


def _respuesta_codigo_invalido():
    return Response(
        {'error': 'El código es inválido o expiró. Solicita uno nuevo.'},
        status=status.HTTP_400_BAD_REQUEST,
    )


class SolicitarCodigoPasswordResetView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def post(self, request):
        email = str(request.data.get('email', '')).strip().lower()
        if not email:
            return Response(
                {'error': 'Ingresa tu correo electrónico.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        usuario = Usuario.objects.filter(email__iexact=email).first()
        if not usuario:
            return Response(RESPUESTA_GENERICA, status=status.HTTP_200_OK)

        ahora = timezone.now()
        recientes = PasswordResetOTP.objects.filter(
            usuario=usuario,
            created_at__gte=ahora - timedelta(minutes=15),
        ).count()
        if recientes >= MAX_SOLICITUDES_15_MIN:
            return Response(
                {'error': 'Has solicitado demasiados códigos. Espera unos minutos.'},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        PasswordResetOTP.objects.filter(usuario=usuario, usado=False).update(usado=True)

        codigo = f'{secrets.randbelow(1_000_000):06d}'
        PasswordResetOTP.objects.create(
            usuario=usuario,
            codigo_hash=make_password(codigo),
            expira_en=ahora + timedelta(minutes=OTP_TTL_MINUTOS),
        )

        try:
            send_mail(
                'Código de recuperación - Bodegas Cercanas',
                (
                    f'Hola {usuario.first_name or usuario.email},\n\n'
                    f'Tu código para restablecer la contraseña es: {codigo}\n\n'
                    f'Este código vence en {OTP_TTL_MINUTOS} minutos. '
                    'Si no solicitaste este cambio, ignora este mensaje.'
                ),
                settings.DEFAULT_FROM_EMAIL,
                [usuario.email],
                fail_silently=False,
            )
        except Exception:
            logger.exception('No se pudo enviar el correo de recuperación a %s', usuario.email)
            return Response(
                {'error': 'No se pudo enviar el correo. Intenta nuevamente más tarde.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        return Response(RESPUESTA_GENERICA, status=status.HTTP_200_OK)


class VerificarCodigoPasswordResetView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def post(self, request):
        email = str(request.data.get('email', '')).strip().lower()
        codigo = str(request.data.get('codigo', '')).strip()

        if not email or not codigo:
            return Response(
                {'error': 'Ingresa tu correo y el código recibido.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        usuario = Usuario.objects.filter(email__iexact=email).first()
        if not usuario:
            return _respuesta_codigo_invalido()

        otp = (
            PasswordResetOTP.objects.filter(usuario=usuario, usado=False)
            .order_by('-created_at')
            .first()
        )
        if not otp or otp.expira_en < timezone.now() or otp.intentos >= MAX_INTENTOS:
            return _respuesta_codigo_invalido()

        if not check_password(codigo, otp.codigo_hash):
            otp.intentos += 1
            otp.save(update_fields=['intentos'])
            return _respuesta_codigo_invalido()

        otp.usado = True
        otp.save(update_fields=['usado'])

        token = signing.dumps({'uid': usuario.id}, salt=RESET_SALT)
        return Response(
            {'reset_token': token, 'mensaje': 'Código verificado.'},
            status=status.HTTP_200_OK,
        )


class ConfirmarPasswordResetView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def post(self, request):
        token = str(request.data.get('reset_token', '')).strip()
        password = str(request.data.get('password', ''))

        if not token:
            return _respuesta_codigo_invalido()
        if len(password) < 6:
            return Response(
                {'error': 'La contraseña debe tener al menos 6 caracteres.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            datos = signing.loads(token, salt=RESET_SALT, max_age=RESET_TOKEN_MAX_AGE)
        except (signing.BadSignature, signing.SignatureExpired):
            return _respuesta_codigo_invalido()

        usuario = Usuario.objects.filter(id=datos.get('uid')).first()
        if not usuario:
            return _respuesta_codigo_invalido()

        usuario.set_password(password)
        usuario.save(update_fields=['password'])
        PasswordResetOTP.objects.filter(usuario=usuario, usado=False).update(usado=True)

        return Response(
            {'mensaje': 'Contraseña actualizada correctamente.'},
            status=status.HTTP_200_OK,
        )
