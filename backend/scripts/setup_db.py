import os
import sys
import django

# Setup Django
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.core.management import call_command

if __name__ == '__main__':
    print('Applying all migrations to create database tables...')
    call_command('makemigrations')
    call_command('migrate')
    print('All tables created successfully!')
