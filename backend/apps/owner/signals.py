"""
Feature Management Cascade System

This module synchronizes feature toggles across three models:
- FeatureToggle (owner app) - Owner controls
- SchoolFeatureConfig (features app) - Source of truth for app logic
- FeatureAccess (platform_admin app) - Legacy, deprecated

When a feature is toggled at the owner level, it cascades to update
SchoolFeatureConfig, which is what the app actually checks.
"""

from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from apps.owner.models import FeatureToggle
from apps.features.models import Feature, SchoolFeatureConfig


@receiver(post_save, sender=FeatureToggle)
def sync_feature_toggle_to_config(sender, instance, created, **kwargs):
    """
    When a FeatureToggle is saved, sync it to SchoolFeatureConfig.
    
    This ensures that owner-level toggles cascade to the app logic layer.
    """
    try:
        # Find the Feature by code matching
        feature = Feature.objects.get(code=instance.feature)
        
        # Update or create SchoolFeatureConfig
        config, _ = SchoolFeatureConfig.objects.get_or_create(
            school=instance.school,
            feature=feature,
            defaults={'enabled': instance.is_enabled}
        )
        
        # Sync the enabled state
        if config.enabled != instance.is_enabled:
            config.enabled = instance.is_enabled
            config.save(update_fields=['enabled'])
            
    except Feature.DoesNotExist:
        # Feature code doesn't exist in Feature model yet
        # This can happen if new features are added to FeatureToggle choices
        # but not added to Feature model
        pass
    except Exception as e:
        # Log silently - don't break the save operation
        print(f"[Feature Cascade] Error syncing toggle {instance.id}: {str(e)}")


@receiver(post_delete, sender=FeatureToggle)
def cascade_feature_toggle_delete(sender, instance, **kwargs):
    """
    When a FeatureToggle is deleted, optionally handle the cascade.
    
    Current behavior: Keep SchoolFeatureConfig as-is (don't auto-delete).
    This allows manual management of feature configs.
    """
    pass


def register_signals():
    """
    Register all feature management signals.
    Call this in apps.py ready() method.
    """
    # Signals are auto-registered via @receiver decorator
    pass
