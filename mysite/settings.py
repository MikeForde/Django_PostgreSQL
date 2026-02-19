import os
from dotenv.main import load_dotenv
import dj_database_url

# Load .env file
load_dotenv()

from pathlib import Path

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

TEX_LIBRARY_DIR = BASE_DIR / "tex_library"   # e.g. <project>/tex_library
TEX_LIBRARY_DIR.mkdir(exist_ok=True)
DOCX_LIBRARY_DIR = BASE_DIR / "docx_library"
DOCX_LIBRARY_DIR.mkdir(exist_ok=True)
DOCX_PREVIEW_CACHE_DIR = BASE_DIR / "docx_preview_cache"


SNOWFUSION_BASE_URL = "https://snowfusion-d2s-uksc-medsnomed-medsno.apps.ocp1.azure.dso.digital.mod.uk"


# Quick-start development settings - unsuitable for production
# See https://docs.djangoproject.com/en/5.0/howto/deployment/checklist/

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = 'django-insecure-m8sm5q*c-pri$a$vlnhj3vgil-&29=2+oi9h*z#7c6l4+q*o#z'

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = True

ALLOWED_HOSTS = [
    'django-postgre-sql-uksc-medsnomed-medsno.apps.ocp1.azure.dso.digital.mod.uk',
    'localhost',
    # Optionally add other hosts or wildcard subdomains
    # '.apps.ocp1.azure.dso.digital.mod.uk',
]

CSRF_TRUSTED_ORIGINS = [
    "https://django-postgre-sql-uksc-medsnomed-medsno.apps.ocp1.azure.dso.digital.mod.uk",
]


# Application definition

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'myapp',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'mysite.urls'

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

WSGI_APPLICATION = 'mysite.wsgi.application'


# Database
# https://docs.djangoproject.com/en/5.0/ref/settings/#databases

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.getenv('DB_NAME'),
        'USER': os.getenv('DB_USER'),
        'PASSWORD': os.getenv('DB_PASSWORD'),
        'HOST': os.getenv('DB_HOST'),
        'PORT': os.getenv('DB_PORT', '5432'),
    }
}

PASSWORD_HASHERS = [
    'django.contrib.auth.hashers.PBKDF2PasswordHasher',
    # 'django.contrib.auth.hashers.BCryptSHA256PasswordHasher', # also FIPS-compliant in most cases
    # 'django.contrib.auth.hashers.Argon2PasswordHasher',        # if Argon2 is supported and installed
    # 'django.contrib.auth.hashers.PBKDF2SHA1PasswordHasher',    # SHA1 may be disallowed under strict FIPS
]



# Password validation
# https://docs.djangoproject.com/en/5.0/ref/settings/#auth-password-validators

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]


# Internationalization
# https://docs.djangoproject.com/en/5.0/topics/i18n/

LANGUAGE_CODE = 'en-us'

TIME_ZONE = 'UTC'

USE_I18N = True

USE_TZ = True


# Static files (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/5.0/howto/static-files/

STATIC_URL = 'static/'

# Default primary key field type
# https://docs.djangoproject.com/en/5.0/ref/settings/#default-auto-field

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
