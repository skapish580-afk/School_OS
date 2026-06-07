import os
import sys
import django

sys.path.append(os.getcwd())
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.contrib.auth import get_user_model
User = get_user_model()

email = 'owner@schoolos.com'
password = 'owner123'

user, created = User.objects.get_or_create(
    email=email,
    defaults={
        'first_name': 'Platform',
        'last_name': 'Owner',
        'user_type': 'PLATFORM_ADMIN',
        'is_staff': True,
        'is_superuser': True,
    }
)

if created:
    user.set_password(password)
    user.save()
    print(f"✅ Successfully created user: {email} with password: {password}")
else:
    user.set_password(password)
    user.save()
    print(f"🔄 User {email} already existed. Password reset to: {password}")
