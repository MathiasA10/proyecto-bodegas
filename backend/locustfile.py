from locust import HttpUser, between, task


class BodegasUser(HttpUser):
    wait_time = between(1, 3)

    @task(3)
    def mapa_bodegas(self):
        self.client.get('/api/public/bodegas/?lat=-12.046374&lng=-77.042793')

    @task(2)
    def detalle_bodega(self):
        self.client.get('/api/public/bodegas/1/')

    @task(1)
    def health(self):
        self.client.get('/healthz/')
