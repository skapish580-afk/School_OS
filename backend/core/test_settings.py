from .settings import *

# Use a lightweight SQLite DB for tests to avoid needing DB creation permissions.
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': ':memory:',
    }
}

# Disable migrations for faster test runs (optional)
MIGRATION_MODULES = {}
