from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core import mail
from django.core.cache import cache
from django.test import SimpleTestCase, TestCase
from rest_framework.test import APIClient
from rest_framework.throttling import ScopedRateThrottle

from .models import Bodega, Categoria, PasswordResetOTP, Producto
from .utils.geo import haversine_km

User = get_user_model()


class GeoUtilsTests(SimpleTestCase):
    def test_same_point_is_zero(self):
        self.assertEqual(haversine_km(-12.046374, -77.042793, -12.046374, -77.042793), 0.0)

    def test_known_short_distance(self):
        # ~1.11 km por 0.01 grados de latitud en Lima
        distancia = haversine_km(-12.046374, -77.042793, -12.056374, -77.042793)
        self.assertAlmostEqual(distancia, 1.11, delta=0.05)

    def test_invalid_coordinates_return_none(self):
        self.assertIsNone(haversine_km(None, -77.0, -12.0, -77.0))
        self.assertIsNone(haversine_km('abc', -77.0, -12.0, -77.0))


class BaseApiTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='bodega_test',
            email='bodega@test.com',
            password='secret123',
            rol='BODEGUERO',
        )
        self.bodega = Bodega.objects.create(
            usuario=self.user,
            nombre_comercial='Bodega Test',
            direccion='Av. Test 123',
            latitud=-12.046374,
            longitud=-77.042793,
            radio_entrega_km=3,
        )
        self.categoria = Categoria.objects.get(bodega=self.bodega, nombre='Bebidas')
        self.producto = Producto.objects.create(
            bodega=self.bodega,
            nombre='Agua 600ml',
            precio=2.50,
            stock=10,
            categoria=self.categoria,
        )
        self.cliente = User.objects.create_user(
            username='cliente_test',
            email='cliente@test.com',
            password='secret123',
            rol='CLIENTE',
        )
        self.client = APIClient()

    def crear_pedido(self, **overrides):
        self.client.force_authenticate(user=self.cliente)
        payload = {
            'bodega_id': self.bodega.id,
            'nombre_cliente': 'Cliente Test',
            'telefono_cliente': '999999999',
            'direccion_entrega': 'Calle Falsa 123',
            'metodo_entrega': 'DELIVERY',
            'metodo_pago': 'CONTRA_ENTREGA',
            'cliente_lat': -12.046374,
            'cliente_lng': -77.042793,
            'items': [{'id': self.producto.id, 'cantidad': 2}],
        }
        payload.update(overrides)
        return self.client.post('/api/public/pedidos/crear/', payload, format='json')


class ThrottleTests(BaseApiTestCase):
    def test_login_rate_limit(self):
        cache.clear()
        self.client.force_authenticate(user=None)

        with patch.object(ScopedRateThrottle, 'THROTTLE_RATES', {'login': '2/min'}):
            for _ in range(2):
                res = self.client.post(
                    '/api/auth/login/',
                    {'email': self.user.email, 'password': 'secret123'},
                    format='json',
                )
                self.assertEqual(res.status_code, 200, res.data)

            res = self.client.post(
                '/api/auth/login/',
                {'email': self.user.email, 'password': 'secret123'},
                format='json',
            )
            self.assertEqual(res.status_code, 429)


class BodegasPublicasTests(BaseApiTestCase):
    def test_mapa_incluye_bodega_dentro_del_radio(self):
        res = self.client.get(
            '/api/public/bodegas/',
            {'lat': -12.046374, 'lng': -77.042793},
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data), 1)
        self.assertEqual(res.data[0]['productos_count'], 1)
        self.assertAlmostEqual(res.data[0]['distancia_km'], 0.0, places=2)

    def test_mapa_excluye_bodega_fuera_del_radio(self):
        res = self.client.get(
            '/api/public/bodegas/',
            {'lat': -12.100000, 'lng': -77.100000},
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data, [])

    def test_mapa_oculta_bodegas_cerradas(self):
        self.bodega.abierto = False
        self.bodega.save()

        res = self.client.get(
            '/api/public/bodegas/',
            {'lat': -12.046374, 'lng': -77.042793},
        )
        self.assertEqual(res.data, [])

    def test_detalle_publico_incluye_catalogo(self):
        res = self.client.get(f'/api/public/bodegas/{self.bodega.id}/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['nombre_comercial'], 'Bodega Test')
        self.assertEqual(len(res.data['productos']), 1)
        self.assertEqual(res.data['productos'][0]['categoria'], self.categoria.id)
        self.assertEqual(res.data['productos'][0]['categoria_nombre'], 'Bebidas')
        self.assertIn('categorias', res.data)


class CrearPedidoTests(BaseApiTestCase):
    def test_delivery_dentro_del_radio_descuenta_stock(self):
        res = self.crear_pedido()
        self.assertEqual(res.status_code, 201, res.data)

        self.producto.refresh_from_db()
        self.assertEqual(self.producto.stock, 8)
        self.assertAlmostEqual(res.data['distancia_km'], 0.0, places=2)

    def test_delivery_fuera_del_radio_es_rechazado(self):
        res = self.crear_pedido(cliente_lat=-12.100000, cliente_lng=-77.100000)
        self.assertEqual(res.status_code, 400)
        self.assertIn('radio de entrega', res.data['error'])

        self.producto.refresh_from_db()
        self.assertEqual(self.producto.stock, 10)

    def test_delivery_sin_coordenadas_es_rechazado(self):
        res = self.crear_pedido(cliente_lat=None, cliente_lng=None)
        self.assertEqual(res.status_code, 400)

    def test_recojo_sin_coordenadas_es_valido(self):
        res = self.crear_pedido(
            metodo_entrega='RECOJO', cliente_lat=None, cliente_lng=None
        )
        self.assertEqual(res.status_code, 201, res.data)

    def test_bodega_cerrada_no_recibe_pedidos(self):
        self.bodega.abierto = False
        self.bodega.save()

        res = self.crear_pedido()
        self.assertEqual(res.status_code, 400)
        self.assertIn('cerrada', res.data['error'])

    def test_cantidad_negativa_es_rechazada(self):
        res = self.crear_pedido(items=[{'id': self.producto.id, 'cantidad': -3}])
        self.assertEqual(res.status_code, 400)

    def test_stock_insuficiente_es_rechazado(self):
        res = self.crear_pedido(items=[{'id': self.producto.id, 'cantidad': 99}])
        self.assertEqual(res.status_code, 400)


class CambiarEstadoPedidoTests(BaseApiTestCase):
    def setUp(self):
        super().setUp()
        res = self.crear_pedido()
        self.assertEqual(res.status_code, 201, res.data)
        self.pedido_id = res.data['pedido_id']
        self.client.force_authenticate(user=self.user)

    def test_cancelar_restaura_stock(self):
        self.producto.refresh_from_db()
        self.assertEqual(self.producto.stock, 8)

        res = self.client.patch(
            f'/api/bodega/pedidos/{self.pedido_id}/estado/',
            {'estado': 'CANCELADO'},
            format='json',
        )
        self.assertEqual(res.status_code, 200, res.data)

        self.producto.refresh_from_db()
        self.assertEqual(self.producto.stock, 10)

    def test_transicion_invalida_es_rechazada(self):
        res = self.client.patch(
            f'/api/bodega/pedidos/{self.pedido_id}/estado/',
            {'estado': 'ENTREGADO'},
            format='json',
        )
        self.assertEqual(res.status_code, 400)

    def test_delivery_no_admite_listo_para_recoger(self):
        self.client.patch(
            f'/api/bodega/pedidos/{self.pedido_id}/estado/',
            {'estado': 'EN_PREPARACIÓN'},
            format='json',
        )
        res = self.client.patch(
            f'/api/bodega/pedidos/{self.pedido_id}/estado/',
            {'estado': 'LISTO_PARA_RECOGER'},
            format='json',
        )
        self.assertEqual(res.status_code, 400)


class CambiarEstadoPedidoRecojoTests(BaseApiTestCase):
    def setUp(self):
        super().setUp()
        res = self.crear_pedido(
            metodo_entrega='RECOJO',
            cliente_lat=None,
            cliente_lng=None,
        )
        self.assertEqual(res.status_code, 201, res.data)
        self.pedido_id = res.data['pedido_id']
        self.client.force_authenticate(user=self.user)

    def cambiar_estado(self, estado):
        return self.client.patch(
            f'/api/bodega/pedidos/{self.pedido_id}/estado/',
            {'estado': estado},
            format='json',
        )

    def test_recojo_completa_flujo_con_listo_para_recoger(self):
        res = self.cambiar_estado('EN_PREPARACIÓN')
        self.assertEqual(res.status_code, 200, res.data)

        res = self.cambiar_estado('LISTO_PARA_RECOGER')
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data['nuevo_estado'], 'LISTO_PARA_RECOGER')

        res = self.cambiar_estado('ENTREGADO')
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data['nuevo_estado'], 'ENTREGADO')

    def test_recojo_no_admite_en_camino(self):
        res = self.cambiar_estado('EN_PREPARACIÓN')
        self.assertEqual(res.status_code, 200, res.data)

        res = self.cambiar_estado('EN_CAMINO')
        self.assertEqual(res.status_code, 400)

    def test_recojo_listo_para_recoger_puede_cancelarse(self):
        self.cambiar_estado('EN_PREPARACIÓN')
        self.cambiar_estado('LISTO_PARA_RECOGER')

        res = self.cambiar_estado('CANCELADO')
        self.assertEqual(res.status_code, 200, res.data)

        self.producto.refresh_from_db()
        self.assertEqual(self.producto.stock, 10)


class CrearPedidoAutenticacionTests(BaseApiTestCase):
    def test_crear_pedido_sin_autenticacion_es_rechazado(self):
        self.client.force_authenticate(user=None)
        res = self.client.post(
            '/api/public/pedidos/crear/',
            {
                'bodega_id': self.bodega.id,
                'nombre_cliente': 'Cliente Test',
                'telefono_cliente': '999999999',
                'direccion_entrega': 'Calle Falsa 123',
                'metodo_entrega': 'RECOJO',
                'metodo_pago': 'CONTRA_ENTREGA',
                'items': [{'id': self.producto.id, 'cantidad': 1}],
            },
            format='json',
        )
        self.assertEqual(res.status_code, 401)

    def test_telefono_invalido_es_rechazado(self):
        res = self.crear_pedido(telefono_cliente='12345')
        self.assertEqual(res.status_code, 400)
        self.assertIn('teléfono', res.data['error'].lower())

    def test_bodeguero_no_puede_crear_pedido_como_cliente(self):
        self.client.force_authenticate(user=self.user)
        res = self.client.post(
            '/api/public/pedidos/crear/',
            {
                'bodega_id': self.bodega.id,
                'nombre_cliente': 'Cliente Test',
                'telefono_cliente': '999999999',
                'direccion_entrega': 'Calle Falsa 123',
                'metodo_entrega': 'RECOJO',
                'metodo_pago': 'CONTRA_ENTREGA',
                'items': [{'id': self.producto.id, 'cantidad': 1}],
            },
            format='json',
        )
        self.assertEqual(res.status_code, 403)


class CategoriasApiTests(BaseApiTestCase):
    def setUp(self):
        super().setUp()
        self.client.force_authenticate(user=self.user)

    def test_lista_categorias_iniciales(self):
        res = self.client.get('/api/bodega/categorias/')
        self.assertEqual(res.status_code, 200)
        nombres = {categoria['nombre'] for categoria in res.data}
        self.assertEqual(
            nombres,
            {'Abarrotes', 'Bebidas', 'Limpieza', 'Snacks', 'Otros'},
        )

    def test_crear_categoria(self):
        res = self.client.post(
            '/api/bodega/categorias/',
            {'nombre': 'Frutas', 'orden': 5},
            format='json',
        )
        self.assertEqual(res.status_code, 201, res.data)
        self.assertTrue(
            Categoria.objects.filter(bodega=self.bodega, nombre='Frutas').exists()
        )

    def test_no_eliminar_categoria_con_productos(self):
        res = self.client.delete(f'/api/bodega/categorias/{self.categoria.id}/')
        self.assertEqual(res.status_code, 400)
        self.assertTrue(Categoria.objects.filter(id=self.categoria.id).exists())

    def test_eliminar_categoria_vacia(self):
        categoria = Categoria.objects.create(bodega=self.bodega, nombre='Temporal')
        res = self.client.delete(f'/api/bodega/categorias/{categoria.id}/')
        self.assertEqual(res.status_code, 204)


class SeguimientoPedidoTests(BaseApiTestCase):
    def setUp(self):
        super().setUp()
        res = self.crear_pedido()
        self.assertEqual(res.status_code, 201, res.data)
        self.pedido_id = res.data['pedido_id']

    def test_dueno_puede_ver_seguimiento(self):
        self.client.force_authenticate(user=self.cliente)
        res = self.client.get(f'/api/cliente/pedidos/{self.pedido_id}/seguimiento/')
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data['pedido_id'], self.pedido_id)
        self.assertTrue(res.data['items'])

    def test_otro_cliente_no_puede_ver_seguimiento(self):
        otro = User.objects.create_user(
            username='otro_cliente',
            email='otro@test.com',
            password='secret123',
            rol='CLIENTE',
        )
        self.client.force_authenticate(user=otro)
        res = self.client.get(f'/api/cliente/pedidos/{self.pedido_id}/seguimiento/')
        self.assertEqual(res.status_code, 403)

    def test_anonimo_no_puede_ver_seguimiento(self):
        self.client.force_authenticate(user=None)
        res = self.client.get(f'/api/cliente/pedidos/{self.pedido_id}/seguimiento/')
        self.assertEqual(res.status_code, 401)


class PasswordResetTests(BaseApiTestCase):
    def test_flujo_completo_otp(self):
        res = self.client.post(
            '/api/auth/password-reset/request/',
            {'email': self.cliente.email},
            format='json',
        )
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(len(mail.outbox), 1)

        import re

        codigo = re.search(r'\b(\d{6})\b', mail.outbox[0].body).group(1)

        res = self.client.post(
            '/api/auth/password-reset/verify/',
            {'email': self.cliente.email, 'codigo': codigo},
            format='json',
        )
        self.assertEqual(res.status_code, 200, res.data)
        token = res.data['reset_token']

        res = self.client.post(
            '/api/auth/password-reset/confirm/',
            {'reset_token': token, 'password': 'nuevaClave123'},
            format='json',
        )
        self.assertEqual(res.status_code, 200, res.data)

        self.cliente.refresh_from_db()
        self.assertTrue(self.cliente.check_password('nuevaClave123'))
        self.assertTrue(
            PasswordResetOTP.objects.filter(
                usuario=self.cliente, usado=True
            ).exists()
        )

    def test_codigo_invalido_es_rechazado(self):
        self.client.post(
            '/api/auth/password-reset/request/',
            {'email': self.cliente.email},
            format='json',
        )
        res = self.client.post(
            '/api/auth/password-reset/verify/',
            {'email': self.cliente.email, 'codigo': '000000'},
            format='json',
        )
        self.assertEqual(res.status_code, 400)
