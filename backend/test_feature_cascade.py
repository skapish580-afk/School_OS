"""
Test Feature Toggle Cascade
Verifies that disabling a feature at owner level cascades to SchoolFeatureConfig
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from apps.schools.models import School
from apps.features.models import Feature, SchoolFeatureConfig
from apps.owner.models import FeatureToggle

print("=" * 70)
print("🧪 FEATURE TOGGLE CASCADE TEST")
print("=" * 70)

# Get test school and feature
school = School.objects.first()
feature = Feature.objects.get(code='ATTENDANCE')

print(f"\n📍 Test Setup:")
print(f"  School: {school.display_name}")
print(f"  Feature: {feature.name} ({feature.code})")

# Check initial state
print(f"\n📊 Initial States:")
toggle = FeatureToggle.objects.get(school=school, feature='ATTENDANCE')
config = SchoolFeatureConfig.objects.get(school=school, feature=feature)
print(f"  FeatureToggle.is_enabled: {toggle.is_enabled}")
print(f"  SchoolFeatureConfig.enabled: {config.enabled}")

# Test 1: Disable via FeatureToggle
print(f"\n🧪 Test 1: Disable via FeatureToggle")
toggle.is_enabled = False
toggle.save()
print(f"  ✓ Disabled FeatureToggle")

# Refresh and check
config.refresh_from_db()
toggle.refresh_from_db()
print(f"  After cascade:")
print(f"    - FeatureToggle.is_enabled: {toggle.is_enabled}")
print(f"    - SchoolFeatureConfig.enabled: {config.enabled}")
assert config.enabled == False, "❌ Cascade failed! SchoolFeatureConfig not updated"
print(f"  ✅ Cascade successful!")

# Test 2: Re-enable via FeatureToggle
print(f"\n🧪 Test 2: Re-enable via FeatureToggle")
toggle.is_enabled = True
toggle.save()
print(f"  ✓ Enabled FeatureToggle")

# Refresh and check
config.refresh_from_db()
toggle.refresh_from_db()
print(f"  After cascade:")
print(f"    - FeatureToggle.is_enabled: {toggle.is_enabled}")
print(f"    - SchoolFeatureConfig.enabled: {config.enabled}")
assert config.enabled == True, "❌ Cascade failed! SchoolFeatureConfig not updated"
print(f"  ✅ Cascade successful!")

# Test 3: Check feature visibility
print(f"\n🧪 Test 3: Feature Visibility Check")
print(f"  When ATTENDANCE is disabled:")
toggle.is_enabled = False
toggle.save()
config.refresh_from_db()

enabled_features = SchoolFeatureConfig.objects.filter(
    school=school,
    enabled=True
).count()
print(f"    - Total enabled features: {enabled_features} (should be 8 now)")
assert enabled_features == 8, "❌ Visibility test failed!"
print(f"  ✅ Visibility correct!")

# Test 4: Re-enable for cleanup
print(f"\n🧪 Test 4: Cleanup (re-enable all)")
toggle.is_enabled = True
toggle.save()
config.refresh_from_db()

enabled_features = SchoolFeatureConfig.objects.filter(
    school=school,
    enabled=True
).count()
print(f"    - Total enabled features: {enabled_features} (should be 9 now)")
assert enabled_features == 9, "❌ Cleanup failed!"
print(f"  ✅ Cleanup successful!")

print("\n" + "=" * 70)
print("✅ ALL CASCADE TESTS PASSED")
print("=" * 70)
print("\n📌 Summary:")
print("  - FeatureToggle changes cascade to SchoolFeatureConfig")
print("  - Feature visibility updates correctly")
print("  - Cascade mechanism is working as expected")
