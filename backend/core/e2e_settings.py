import os

from .test_settings import *  # noqa: F401,F403

DEBUG = True

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.getenv('E2E_DB_NAME', 'bodegas_e2e'),
        'USER': os.getenv('TEST_DB_USER', 'bodegas_test'),
        'PASSWORD': os.getenv('TEST_DB_PASSWORD', 'bodegas_test'),
        'HOST': os.getenv('TEST_DB_HOST', '127.0.0.1'),
        'PORT': os.getenv('TEST_DB_PORT', '5432'),
    }
}

EMAIL_BACKEND = 'django.core.mail.backends.locmem.EmailBackend'
