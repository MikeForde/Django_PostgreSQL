POC of Django, PostgreSQL and OpenShift (OS)

#Notes:
- Use Django 4.0 as default - and perhaps only - PostgreSQL on org OS is 10.13
- Possible that version 4.0.11 works but 4.0 is fine at moment.
- Although current version of Django is 5.0+, the current course on Org Percipio is using 3.1 and the oldest book by that means (from 2021) is installing 2.2!
- Organization version of OS uses FIPS which means MD5 is out - use Monkey Patch (as per manage.py code) to enforce SHA256
- After changing code and rebuilding, you need to stop and restart pod.
- You need to set ALLOWED_HOSTS to the OS address for the webapp to be accessible via OS
- For the admin/login function to workon OS you need to set the CSRF_TRUSTED_ORIGINS to the same OS address
- The easiest way to set up the superuser is to connect to the OS PostgreSQL instance using the terminal oc method and then perform the createsuperuser in the local VS Code version of the Django webapp - you may need to change the database name in the local .env file if it doesn't match the one used in the OS version.
