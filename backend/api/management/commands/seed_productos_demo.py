from decimal import Decimal

from django.core.management.base import BaseCommand, CommandError

from api.models import Bodega, Categoria, Producto


PRODUCTOS_DEMO = [
    {
        'nombre': 'Arroz extra 1 kg',
        'descripcion': 'Arroz extra de grano largo, bolsa de 1 kg.',
        'categoria': 'Abarrotes',
        'precio': Decimal('4.50'),
        'stock': 30,
    },
    {
        'nombre': 'Aceite vegetal 1 L',
        'descripcion': 'Aceite vegetal para cocina, botella de 1 litro.',
        'categoria': 'Abarrotes',
        'precio': Decimal('8.90'),
        'stock': 24,
    },
    {
        'nombre': 'Leche entera 1 L',
        'descripcion': 'Leche entera en caja de 1 litro.',
        'categoria': 'Abarrotes',
        'precio': Decimal('4.20'),
        'stock': 36,
    },
    {
        'nombre': 'Agua mineral 600 ml',
        'descripcion': 'Agua mineral sin gas, botella de 600 ml.',
        'categoria': 'Bebidas',
        'precio': Decimal('1.50'),
        'stock': 48,
    },
    {
        'nombre': 'Detergente 780 g',
        'descripcion': 'Detergente en polvo para ropa, bolsa de 780 g.',
        'categoria': 'Limpieza',
        'precio': Decimal('11.90'),
        'stock': 20,
    },
    {
        'nombre': 'Galletas de chocolate',
        'descripcion': 'Galletas rellenas de chocolate, paquete individual.',
        'categoria': 'Snacks',
        'precio': Decimal('1.80'),
        'stock': 40,
    },
]

ORDEN_CATEGORIAS = {
    'Abarrotes': 0,
    'Bebidas': 1,
    'Limpieza': 2,
    'Snacks': 3,
    'Otros': 4,
}


class Command(BaseCommand):
    help = 'Agrega productos demo a la bodega de un usuario vendedor.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--email',
            default='mathicrack999@gmail.com',
            help='Email del usuario vendedor.',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Muestra los productos que se crearían sin guardar cambios.',
        )

    def handle(self, *args, **options):
        email = options['email']
        dry_run = options['dry_run']

        bodega = Bodega.objects.filter(usuario__email__iexact=email).first()
        if bodega is None:
            raise CommandError(
                f'No se encontró una bodega para el usuario {email}.'
            )

        creados = []
        existentes = []

        for producto in PRODUCTOS_DEMO:
            categoria, _ = Categoria.objects.get_or_create(
                bodega=bodega,
                nombre=producto['categoria'],
                defaults={
                    'orden': ORDEN_CATEGORIAS.get(producto['categoria'], 99),
                },
            )

            ya_existe = Producto.objects.filter(
                bodega=bodega,
                nombre__iexact=producto['nombre'],
            ).exists()
            if ya_existe:
                existentes.append(producto['nombre'])
                continue

            creados.append(producto['nombre'])
            if dry_run:
                continue

            Producto.objects.create(
                bodega=bodega,
                categoria=categoria,
                nombre=producto['nombre'],
                descripcion=producto['descripcion'],
                precio=producto['precio'],
                stock=producto['stock'],
            )

        modo = 'DRY RUN' if dry_run else 'APLICADO'
        self.stdout.write(self.style.SUCCESS(f'[{modo}] Bodega: {bodega.nombre_comercial}'))
        self.stdout.write(f'Productos creados: {len(creados)}')
        for nombre in creados:
            self.stdout.write(f'  + {nombre}')
        if existentes:
            self.stdout.write(f'Productos existentes omitidos: {len(existentes)}')
            for nombre in existentes:
                self.stdout.write(f'  = {nombre}')
