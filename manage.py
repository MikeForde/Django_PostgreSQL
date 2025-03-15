#!/usr/bin/env python
"""Django's command-line utility for administrative tasks in FIPS mode."""
import os
import sys
import hashlib

def fips_names_digest(*args, length=None):
    """Use SHA256 instead of MD5 to comply with FIPS mode."""
    hasher = hashlib.sha256()
    for arg in args:
        if isinstance(arg, str):
            arg = arg.encode()
        hasher.update(arg)
    digest = hasher.hexdigest()
    return digest[:length] if length else digest

def main():
    """Run administrative tasks."""
    # 1) Monkey-patch Django's names_digest here,
    #    BEFORE we import `execute_from_command_line`.
    try:
        from django.db.backends import utils as db_backends_utils
        db_backends_utils.names_digest = fips_names_digest
    except ImportError:
        # If Django isn't installed or something else goes wrong,
        # we just skip patching.
        pass

    # 2) Now proceed with normal Django setup.
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'mysite.settings')
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Couldn't import Django. Are you sure it's installed and "
            "available on your PYTHONPATH environment variable? Did you "
            "forget to activate a virtual environment?"
        ) from exc

    execute_from_command_line(sys.argv)


if __name__ == '__main__':
    main()

