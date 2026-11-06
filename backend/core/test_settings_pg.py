import os

from .test_settings import *  # noqa: F401,F403

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.getenv('TEST_DB_NAME', 'bodegas_test'),
        'USER': os.getenv('TEST_DB_USER', 'bodegas_test'),
        'PASSWORD': os.getenv('TEST_DB_PASSWORD', 'bodegas_test'),
        'HOST': os.getenv('TEST_DB_HOST', '127.0.0.1'),
        'PORT': os.getenv('TEST_DB_PORT', '5432'),
        'TEST': {
            'NAME': os.getenv('TEST_DB_TEST_NAME', 'test_bodegas_test'),
        },
    }
}
