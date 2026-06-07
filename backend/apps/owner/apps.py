from django.apps import AppConfig


class OwnerConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.owner'
    verbose_name = 'Platform Owner'    
    def ready(self):
        """Register signals when app is ready."""
        from . import signals  # noqa: F401
        signals.register_signals()