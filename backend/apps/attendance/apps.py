from django.apps import AppConfig

class AttendanceConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    # FIX: Add 'apps.' prefix
    name = 'apps.attendance'