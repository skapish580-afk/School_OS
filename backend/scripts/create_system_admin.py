import os
import sys
import django

# Ensure backend root directory is in Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Set up Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.contrib.auth import get_user_model

def create_or_update_admin():
    User = get_user_model()
    email = os.environ.get('ADMIN_EMAIL', 'schoolos@gmail.com')
    password = os.environ.get('ADMIN_PASSWORD', 'schoolos123')

    user, created = User.objects.get_or_create(
        email=email,
        defaults={
            'first_name': 'System',
            'last_name': 'Admin',
            'user_type': 'PLATFORM_ADMIN',
            'is_staff': True,
            'is_superuser': True,
        }
    )

    user.set_password(password)
    user.user_type = 'PLATFORM_ADMIN'
    user.is_staff = True
    user.is_superuser = True
    user.save()

    if created:
        print(f"[OK] Successfully created System Admin: {email}")
    else:
        print(f"[OK] System Admin {email} updated with latest credentials.")

if __name__ == '__main__':
    create_or_update_admin()
