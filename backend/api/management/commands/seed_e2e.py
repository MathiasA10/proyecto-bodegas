import os
from decimal import Decimal

from django.core.management.base import BaseCommand

from api.models import Bodega, Categoria, Producto, Usuario


SELLER_EMAIL = os.getenv('E2E_SELLER_EMAIL', 'e2e.vendedor@test.com')
CLIENT_EMAIL = os.getenv('E2E_CLIENT_EMAIL', 'e2e.cliente@test.com')
PASSWORD = os.getenv('E2E_TEST_PASSWORD', 'E2Epassword123!')


class Command(BaseCommand):
    help = 'Crea cuentas y datos aislados para pruebas E2E.'

    def handle(self, *args, **options):
        vendedor, _ = Usuario.objects.update_or_create(
            email=SELLER_EMAIL,
            defaults={
                'username': 'e2e_vendedor',
                'first_name': 'Vendedor',
                'last_name': 'E2E',
                'rol': 'BODEGUERO',
                'dni': None,
            },
        )
        vendedor.set_password(PASSWORD)
        vendedor.save(update_fields=['password'])

        cliente, _ = Usuario.objects.update_or_create(
            email=CLIENT_EMAIL,
            defaults={
                'username': 'e2e_cliente',
                'first_name': 'Cliente',
                'last_name': 'E2E',
                'rol': 'CLIENTE',
                'dni': None,
            },
        )
        cliente.set_password(PASSWORD)
        cliente.save(update_fields=['password'])

        bodega, _ = Bodega.objects.update_or_create(
            usuario=vendedor,
            defaults={
                'nombre_comercial': 'Bodega E2E',
                'direccion': 'Av. Pruebas 123',
                'latitud': Decimal('-12.046374'),
                'longitud': Decimal('-77.042793'),
                'telefono': '999999999',
                'abierto': True,
                'radio_entrega_km': Decimal('3.00'),
            },
        )

        categoria, _ = Categoria.objects.get_or_create(
            bodega=bodega,
            nombre='Abarrotes',
            defaults={'orden': 0},
        )
        Producto.objects.update_or_create(
            bodega=bodega,
            nombre='Producto E2E',
            defaults={
                'descripcion': 'Producto para pruebas E2E.',
                'precio': Decimal('5.00'),
                'stock': 100,
                'categoria': categoria,
            },
        )

        self.stdout.write(self.style.SUCCESS('Datos E2E listos.'))
        self.stdout.write(f'Vendedor: {SELLER_EMAIL} / {PASSWORD}')
        self.stdout.write(f'Cliente: {CLIENT_EMAIL} / {PASSWORD}')
