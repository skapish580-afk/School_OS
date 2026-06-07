from django.contrib import admin
from .models import School
from .models_calendar import Holiday, SchoolEvent

@admin.register(School)
class SchoolAdmin(admin.ModelAdmin):
    list_display = ('name', 'code', 'board')


@admin.register(Holiday)
class HolidayAdmin(admin.ModelAdmin):
    list_display = ('name', 'date', 'school', 'is_recurring')
    list_filter = ('school', 'is_recurring', 'date')
    search_fields = ('name',)
    date_hierarchy = 'date'


@admin.register(SchoolEvent)
class SchoolEventAdmin(admin.ModelAdmin):
    list_display = ('title', 'event_date', 'event_type', 'school')
    list_filter = ('school', 'event_type', 'event_date')
    search_fields = ('title',)
    date_hierarchy = 'event_date'