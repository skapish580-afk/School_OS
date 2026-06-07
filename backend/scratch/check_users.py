import os
import sys
import django

# Add the project root to sys.path
sys.path.append(os.getcwd())

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.contrib.auth import get_user_model
User = get_user_model()

print(f"Total users: {User.objects.count()}")
for user in User.objects.all()[:10]:
    print(f"Email: {user.email}, Type: {user.user_type}, Is Superuser: {user.is_superuser}")
