import os
from pathlib import Path
from datetime import timedelta
from urllib.parse import urlparse
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent


def _env_bool(name: str, default: bool = False) -> bool:
    return os.getenv(name, str(default)).strip().lower() in ("1", "true", "yes", "on")


# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = os.getenv('SECRET_KEY', 'django-insecure-change-me-later-for-production')

DEBUG = _env_bool('DEBUG', True)

SILENCED_SYSTEM_CHECKS = ['auth.E003']

ALLOWED_HOSTS = [h for h in os.getenv('ALLOWED_HOSTS', '').split(',') if h] or ['localhost', '127.0.0.1', 'testserver', '0.0.0.0']

# Application definition
INSTALLED_APPS = [
    'corsheaders',
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    # Third Party
    'rest_framework',
    'rest_framework_simplejwt',


    # School-OS Apps (Strict Order)
    'apps.accounts',     # Step 1
    'apps.schools',    # Step 2 (Coming soon)
     'apps.students',   # Step 3
     'apps.teachers',   # Step 3
     'apps.enrollments',
     'apps.timeline',
     'django_filters',
     'apps.academics',
    'apps.promotions',
     'apps.achievements',
     'apps.transfers',
    # 'apps.files',
     'apps.audit',
     'apps.features',
     'apps.attendance',
     'apps.discipline',
     'apps.gatepass',
     'apps.health',
     'apps.finance',
     'apps.platform_admin',
     'apps.notifications',
     'apps.owner',  # Platform Owner System
     'apps.transport',
     'apps.library',
     'apps.assets',
     'apps.onboarding',
     'apps.community',
     'apps.support',
]


MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'corsheaders.middleware.CorsMiddleware', # Added CORS
    'django.contrib.sessions.middleware.SessionMiddleware',
    
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'apps.core.middleware.ThreadLocalRequestMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]


ROOT_URLCONF = 'core.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'core.wsgi.application'

def _database_config_from_env():
    """Return DATABASES['default'] using DATABASE_URL if present, else SQLite.

    Keeps current SQLite workflow intact when DATABASE_URL is unset, so existing
    migrations and dev data are unaffected. Supports postgres/mysql/sqlite URLs
    without extra dependencies.
    """

    db_url = os.getenv('DATABASE_URL')
    if not db_url:
        return {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }

    parsed = urlparse(db_url)
    scheme = parsed.scheme

    if scheme in ('postgres', 'postgresql', 'postgresql_psycopg2'):
        engine = 'django.db.backends.postgresql'
    elif scheme in ('mysql', 'mysql2'):
        engine = 'django.db.backends.mysql'
    elif scheme in ('sqlite', 'sqlite3'):
        engine = 'django.db.backends.sqlite3'
    else:
        # Unknown scheme: fall back to SQLite to avoid breaking startup
        return {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }

    if engine.endswith('sqlite3'):
        db_name = parsed.path or 'db.sqlite3'
        if db_name.startswith('/'):
            db_name = db_name[1:]
        return {
            'ENGINE': engine,
            'NAME': BASE_DIR / db_name if not os.path.isabs(db_name) else db_name,
        }

    return {
        'ENGINE': engine,
        'NAME': (parsed.path or '').lstrip('/') or '',
        'USER': parsed.username or '',
        'PASSWORD': parsed.password or '',
        'HOST': parsed.hostname or '',
        'PORT': parsed.port or '',
        'OPTIONS': {},
    }


# Database
DATABASES = {
    'default': _database_config_from_env(),
}

# PostgreSQL Performance Optimization
if DATABASES['default']['ENGINE'] == 'django.db.backends.postgresql':
    DATABASES['default']['CONN_MAX_AGE'] = 600  # Connection pooling (10 minutes)
    DATABASES['default']['ATOMIC_REQUESTS'] = True  # Wrap each request in transaction
    DATABASES['default']['OPTIONS'] = {
        'connect_timeout': 10,
        'options': '-c statement_timeout=30000',  # 30 second query timeout
    }

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

# Internationalization
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

# Static files
STATIC_URL = 'static/'

# --- SCHOOL-OS CUSTOM CONFIGURATION ---

# 1. Point to our Custom User Model
AUTH_USER_MODEL = 'accounts.User'

# 2. DRF Config
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'apps.accounts.authentication.RoleRevocationJWTAuthentication',
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_FILTER_BACKENDS': (
        'django_filters.rest_framework.DjangoFilterBackend',
    ),
    'EXCEPTION_HANDLER': 'apps.core.exception_handler.custom_exception_handler',
}

# 3. JWT Settings
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=60),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=1),
    'AUTH_HEADER_TYPES': ('Bearer',),
}

# ... existing Static files config ...
STATIC_URL = 'static/'



# ... existing settings ...

# --- CORS CONFIGURATION ---
_cors_env = os.getenv('CORS_ALLOWED_ORIGINS', '')
CORS_ALLOWED_ORIGINS = [origin for origin in _cors_env.split(',') if origin] or [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

CORS_ALLOW_CREDENTIALS = True

# Media Files (Uploaded by users)
MEDIA_URL = '/media/'
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')

# ============================================
# EMAIL CONFIGURATION
# ============================================
# Email Backend - Use console in development, SMTP in production
EMAIL_BACKEND = os.getenv('EMAIL_BACKEND', 'django.core.mail.backends.console.EmailBackend')

# SMTP Settings (for production)
EMAIL_HOST = os.getenv('EMAIL_HOST', 'smtp.gmail.com')
EMAIL_PORT = int(os.getenv('EMAIL_PORT', 587))
EMAIL_USE_TLS = _env_bool('EMAIL_USE_TLS', True)
EMAIL_USE_SSL = _env_bool('EMAIL_USE_SSL', False)
EMAIL_HOST_USER = os.getenv('EMAIL_HOST_USER', '')
EMAIL_HOST_PASSWORD = os.getenv('EMAIL_HOST_PASSWORD', '')

# Default sender
DEFAULT_FROM_EMAIL = os.getenv('DEFAULT_FROM_EMAIL', 'School-OS <noreply@school-os.com>')

# Frontend URL for password reset links
FRONTEND_URL = os.getenv('FRONTEND_URL', 'http://localhost:3000')

# Support email for password reset emails
SUPPORT_EMAIL = os.getenv('SUPPORT_EMAIL', 'support@school-os.com')

# Template directories
TEMPLATES[0]['DIRS'] = [os.path.join(BASE_DIR, 'templates')]