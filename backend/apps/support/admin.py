from django.contrib import admin
from .models import SupportTicket, TicketMessage


class TicketMessageInline(admin.TabularInline):
    model = TicketMessage
    extra = 0
    readonly_fields = ['sender', 'sender_name', 'sender_role', 'is_admin_reply', 'message', 'created_at']


@admin.register(SupportTicket)
class SupportTicketAdmin(admin.ModelAdmin):
    list_display = ['ticket_number', 'title', 'school', 'user_name', 'user_role', 'category', 'status', 'severity', 'created_at']
    list_filter = ['status', 'severity', 'category', 'user_role', 'created_at']
    search_fields = ['ticket_number', 'title', 'description', 'user_name', 'user_email']
    readonly_fields = ['ticket_number', 'created_at', 'updated_at', 'diagnostic_data']
    inlines = [TicketMessageInline]


@admin.register(TicketMessage)
class TicketMessageAdmin(admin.ModelAdmin):
    list_display = ['ticket', 'sender_name', 'sender_role', 'is_admin_reply', 'created_at']
    list_filter = ['is_admin_reply', 'created_at']
    search_fields = ['message', 'sender_name']
