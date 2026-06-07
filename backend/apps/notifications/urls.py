"""
Notification API URLs
"""

from django.urls import path
from . import views

app_name = 'notifications'

urlpatterns = [
    # Templates
    path('templates/', views.NotificationTemplateListView.as_view(), name='template-list'),
    path('templates/<int:pk>/', views.NotificationTemplateDetailView.as_view(), name='template-detail'),
    
    # Logs
    path('logs/', views.NotificationLogListView.as_view(), name='log-list'),
    path('logs/student/<int:student_id>/', views.StudentNotificationLogView.as_view(), name='student-logs'),
    
    # Parent preferences
    path('preferences/', views.ParentPreferencesView.as_view(), name='preferences'),
    
    # Send test notification
    path('send-test/', views.SendTestNotificationView.as_view(), name='send-test'),
]
