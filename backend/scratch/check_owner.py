import os
import sys
import django

sys.path.append(os.getcwd())
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.contrib.auth import get_user_model
User = get_user_model()

email = 'owner@schoolos.com'
user = User.objects.filter(email=email).first()
if user:
    print(f"User {email} exists. Type: {user.user_type}")
else:
    print(f"User {email} does not exist.")

print("\nAvailable Admin/Platform Admin accounts:")
admins = User.objects.filter(user_type__in=['PLATFORM_ADMIN', 'SCHOOL_ADMIN', 'ADMIN'])
for admin in admins:
    print(f"- {admin.email} ({admin.user_type})")
