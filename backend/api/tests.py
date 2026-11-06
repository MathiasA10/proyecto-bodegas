import base64
from unittest.mock import patch

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core import mail
from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import SimpleTestCase, TestCase
from rest_framework.test import APIClient
from rest_framework.throttling import ScopedRateThrottle

from .models import (
    Bodega,
    Categoria,
    DetallePedido,
    PasswordResetOTP,
    Pedido,
    Producto,
)
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


class CookieAuthTests(BaseApiTestCase):
    def login(self):
        return self.client.post(
            '/api/auth/login/',
            {'email': self.user.email, 'password': 'secret123'},
            format='json',
        )

    def test_login_guarda_refresh_en_cookie_httponly(self):
        cache.clear()
        res = self.login()

        self.assertEqual(res.status_code, 200, res.data)
        self.assertIn('access', res.data)
        self.assertNotIn('refresh', res.data)

        cookie = res.cookies[settings.AUTH_REFRESH_COOKIE_NAME]
        self.assertTrue(cookie['httponly'])
        self.assertEqual(cookie['path'], settings.AUTH_REFRESH_COOKIE_PATH)
        self.assertEqual(cookie['samesite'], 'Lax')

    def test_refresh_rota_la_cookie(self):
        cache.clear()
        login = self.login()
        refresh_original = login.cookies[
            settings.AUTH_REFRESH_COOKIE_NAME
        ].value

        res = self.client.post('/api/auth/refresh/', {}, format='json')
        self.assertEqual(res.status_code, 200, res.data)
        self.assertIn('access', res.data)
        refresh_nuevo = res.cookies[
            settings.AUTH_REFRESH_COOKIE_NAME
        ].value
        self.assertNotEqual(refresh_original, refresh_nuevo)

        self.client.cookies[settings.AUTH_REFRESH_COOKIE_NAME] = refresh_original
        res = self.client.post('/api/auth/refresh/', {}, format='json')
        self.assertEqual(res.status_code, 401)

    def test_logout_elimina_cookie_y_revoca_refresh(self):
        cache.clear()
        login = self.login()
        refresh = login.cookies[settings.AUTH_REFRESH_COOKIE_NAME].value

        res = self.client.post('/api/auth/logout/', {}, format='json')
        self.assertEqual(res.status_code, 204)

        self.client.cookies[settings.AUTH_REFRESH_COOKIE_NAME] = refresh
        res = self.client.post('/api/auth/refresh/', {}, format='json')
        self.assertEqual(res.status_code, 401)


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

    def test_recojo_ignora_el_radio_de_entrega(self):
        res = self.crear_pedido(
            metodo_entrega='RECOJO',
            cliente_lat=-12.500000,
            cliente_lng=-77.500000,
            direccion_entrega='',
        )
        self.assertEqual(res.status_code, 201, res.data)
        self.assertIsNone(res.data['distancia_km'])

    def test_idempotency_key_evita_pedido_duplicado(self):
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

        primera = self.client.post(
            '/api/public/pedidos/crear/',
            payload,
            format='json',
            HTTP_IDEMPOTENCY_KEY='checkout-1',
        )
        segunda = self.client.post(
            '/api/public/pedidos/crear/',
            payload,
            format='json',
            HTTP_IDEMPOTENCY_KEY='checkout-1',
        )

        self.assertEqual(primera.status_code, 201, primera.data)
        self.assertEqual(segunda.status_code, 200, segunda.data)
        self.assertEqual(primera.data['pedido_id'], segunda.data['pedido_id'])

        self.producto.refresh_from_db()
        self.assertEqual(self.producto.stock, 8)

        payload['items'][0]['cantidad'] = 1
        tercera = self.client.post(
            '/api/public/pedidos/crear/',
            payload,
            format='json',
            HTTP_IDEMPOTENCY_KEY='checkout-1',
        )
        self.assertEqual(tercera.status_code, 409)

    def test_payload_malformado_no_produce_error_500(self):
        self.client.force_authenticate(user=self.cliente)
        casos = [
            {'bodega_id': []},
            {'metodo_entrega': []},
            {'items': [{'id': [], 'cantidad': 1}]},
            {'items': [{'id': self.producto.id, 'cantidad': 'abc'}]},
        ]

        for caso in casos:
            payload = {
                'bodega_id': self.bodega.id,
                'nombre_cliente': 'Cliente Test',
                'telefono_cliente': '999999999',
                'direccion_entrega': 'Calle Falsa 123',
                'metodo_entrega': 'DELIVERY',
                'metodo_pago': 'CONTRA_ENTREGA',
                'cliente_lat': -12.046374,
                'cliente_lng': -77.042793,
                'items': [{'id': self.producto.id, 'cantidad': 1}],
            }
            payload.update(caso)
            res = self.client.post(
                '/api/public/pedidos/crear/', payload, format='json'
            )
            self.assertEqual(res.status_code, 400, res.data)


class IDORTests(BaseApiTestCase):
    def setUp(self):
        super().setUp()
        self.otro = User.objects.create_user(
            username='otro_bodeguero',
            email='otro_bodeguero@test.com',
            password='secret123',
            rol='BODEGUERO',
        )
        self.otra_bodega = Bodega.objects.create(
            usuario=self.otro,
            nombre_comercial='Otra Bodega',
            direccion='Av. Otra 456',
            latitud=-12.046374,
            longitud=-77.042793,
        )

    def test_no_puede_acceder_a_producto_ajeno(self):
        self.client.force_authenticate(user=self.otro)

        res = self.client.get(f'/api/bodega/productos/{self.producto.id}/')
        self.assertEqual(res.status_code, 404)

        res = self.client.put(
            f'/api/bodega/productos/{self.producto.id}/',
            {'nombre': 'Hackeado', 'precio': '1.00', 'stock': '1', 'categoria': self.categoria.id},
            format='json',
        )
        self.assertEqual(res.status_code, 404)

        res = self.client.delete(f'/api/bodega/productos/{self.producto.id}/')
        self.assertEqual(res.status_code, 404)

    def test_no_puede_eliminar_categoria_ajena(self):
        self.client.force_authenticate(user=self.otro)
        res = self.client.delete(f'/api/bodega/categorias/{self.categoria.id}/')
        self.assertEqual(res.status_code, 404)

    def test_no_puede_cambiar_estado_de_pedido_ajeno(self):
        res = self.crear_pedido()
        pedido_id = res.data['pedido_id']

        self.client.force_authenticate(user=self.otro)
        res = self.client.patch(
            f'/api/bodega/pedidos/{pedido_id}/estado/',
            {'estado': 'EN_PREPARACIÓN'},
            format='json',
        )
        self.assertEqual(res.status_code, 404)


class ProductoImagenTests(BaseApiTestCase):
    def test_fallo_de_cloudinary_no_deja_producto_parcial(self):
        self.client.force_authenticate(user=self.user)
        png = base64.b64decode(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk'
            '+A8AAQUBAScY42YAAAAASUVORK5CYII='
        )
        archivo = SimpleUploadedFile('foto.png', png, content_type='image/png')

        with patch('api.serializers.cloudinary.uploader.upload', side_effect=Exception('boom')):
            res = self.client.post(
                '/api/bodega/productos/',
                {
                    'nombre': 'Producto parcial',
                    'precio': '1.00',
                    'stock': '1',
                    'categoria': self.categoria.id,
                    'imagen_file': archivo,
                },
                format='multipart',
            )

        self.assertEqual(res.status_code, 400)
        self.assertFalse(
            Producto.objects.filter(nombre='Producto parcial').exists()
        )


class PaginacionTests(BaseApiTestCase):
    def test_listado_pedidos_esta_paginado(self):
        Pedido.objects.bulk_create([
            Pedido(
                bodega=self.bodega,
                cliente=self.cliente,
                nombre_cliente=f'Cliente {i}',
                telefono_cliente='999999999',
                direccion_entrega='Calle Falsa 123',
                total=10.00,
            )
            for i in range(25)
        ])

        self.client.force_authenticate(user=self.user)
        res = self.client.get('/api/bodega/pedidos/')

        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data['count'], 25)
        self.assertEqual(len(res.data['results']), 20)
        self.assertIsNotNone(res.data['next'])


class HistorialPedidoTests(BaseApiTestCase):
    def test_eliminar_producto_conserva_el_detalle_historico(self):
        res = self.crear_pedido()
        self.assertEqual(res.status_code, 201, res.data)
        pedido_id = res.data['pedido_id']

        self.client.force_authenticate(user=self.user)
        res = self.client.delete(f'/api/bodega/productos/{self.producto.id}/')
        self.assertEqual(res.status_code, 204, res.data)

        detalle = DetallePedido.objects.get(pedido_id=pedido_id)
        self.assertIsNone(detalle.producto)
        self.assertEqual(detalle.producto_nombre, 'Agua 600ml')


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
