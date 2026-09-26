from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from apps.accounts.views import dashboard_summary
from apps.core.report_views import export_students, export_attendance, export_finance, export_achievements

urlpatterns = [
    path('admin/', admin.site.urls),
    
    # Auth & Dashboard
    path('api/v1/auth/', include('apps.accounts.urls')),
    path('api/v1/dashboard/summary/', dashboard_summary, name='dashboard_summary'),
    
    # Core Entities
    path('api/v1/schools/', include('apps.schools.urls')),
    path('api/v1/students/', include('apps.students.urls')),
    path('api/v1/teachers/', include('apps.teachers.urls')),
    path('api/v1/enrollments/', include('apps.enrollments.urls')),
    path('api/v1/timeline/', include('apps.timeline.urls')),
    
    # Academic Features
    path('api/v1/academics/', include('apps.academics.urls')),
    path('api/v1/attendance/', include('apps.attendance.urls')),
    
    # Student Lifecycle
    path('api/v1/transfers/', include('apps.transfers.urls')),
    path('api/v1/discipline/', include('apps.discipline.urls')),
    path('api/v1/achievements/', include('apps.achievements.urls')),
    
    # Operations
    path('api/v1/gatepass/', include('apps.gatepass.urls')),
    path('api/v1/health/', include('apps.health.urls')),
    path('api/v1/finance/', include('apps.finance.urls')),
    path('api/v1/promotions/', include('apps.promotions.urls')),
    
    # Platform Management
    path('api/v1/platform/', include('apps.platform_admin.urls')),
    
    # Platform Owner (Super Admin)
    path('api/v1/owner/', include('apps.owner.urls')),
    
    # System
    path('api/v1/audit/', include('apps.audit.urls')),
    
    # Notifications
    path('api/v1/notifications/', include('apps.notifications.urls')),
    
    # Phase 2 Modules
    path('api/v1/transport/', include('apps.transport.urls')),
    path('api/v1/library/', include('apps.library.urls')),
    path('api/v1/assets/', include('apps.assets.urls')),

    # Phase 5: Community
    path('api/v1/community/', include('apps.community.urls')),

    # Onboarding & Provisioning
    path('api/v1/onboarding/', include('apps.onboarding.urls')),

    # Support & Telemetry
    path('api/v1/support/', include('apps.support.urls')),

    # Direct Report Exports (bypasses ViewSet router)
    path('api/v1/reports/students/', export_students, name='report-students'),
    path('api/v1/reports/attendance/', export_attendance, name='report-attendance'),
    path('api/v1/reports/finance/', export_finance, name='report-finance'),
    path('api/v1/reports/achievements/', export_achievements, name='report-achievements'),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)