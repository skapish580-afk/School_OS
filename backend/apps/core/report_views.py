"""
Plain Django report export views — no DRF decorators to avoid middleware conflicts.
Registered directly in core/urls.py.
"""
import csv
import json
from django.http import HttpResponse, JsonResponse
from django.views.decorators.http import require_GET
from django.contrib.auth.decorators import login_required

from apps.students.models import Student
from apps.attendance.models import StudentAttendance
from apps.finance.models import Invoice
from apps.achievements.models import StudentYearlyAward

from io import BytesIO
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter, landscape
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet


def _generate_pdf_response(filename, title, headers, data):
    buffer = BytesIO()
    # A4/Letter in landscape is good for wide tables
    doc = SimpleDocTemplate(buffer, pagesize=landscape(letter), rightMargin=30, leftMargin=30, topMargin=30, bottomMargin=30)
    elements = []
    
    styles = getSampleStyleSheet()
    title_style = styles['Heading1']
    title_style.alignment = 1 # Center align
    elements.append(Paragraph(title, title_style))
    elements.append(Spacer(1, 20))
    
    # Ensure all data is string
    str_data = [[str(cell) for cell in row] for row in data]
    table_data = [headers] + str_data
    
    t = Table(table_data, repeatRows=1)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#4f46e5')), # Indigo 600
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
        ('TOPPADDING', (0, 0), (-1, 0), 10),
        ('BACKGROUND', (0, 1), (-1, -1), colors.white),
        ('TEXTCOLOR', (0, 1), (-1, -1), colors.black),
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 1), (-1, -1), 9),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.lightgrey),
        ('VALIGN',(0,0),(-1,-1),'MIDDLE'),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f9fafb')]),
    ]))
    elements.append(t)
    doc.build(elements)
    
    pdf = buffer.getvalue()
    buffer.close()
    
    resp = HttpResponse(pdf, content_type='application/pdf')
    resp['Content-Disposition'] = f'attachment; filename="{filename}.pdf"'
    return resp


def _get_school(user):
    if hasattr(user, 'school') and user.school:
        return user.school
    if hasattr(user, 'teacher_profile') and user.teacher_profile:
        t = user.teacher_profile
        if hasattr(t, 'school') and t.school:
            return t.school
    return None


def _jwt_user(request):
    """
    Extract and validate the JWT token from the Authorization header,
    returning the authenticated User or None.
    """
    from rest_framework_simplejwt.authentication import JWTAuthentication
    auth = JWTAuthentication()
    try:
        result = auth.authenticate(request)
        if result:
            return result[0]
    except Exception:
        pass
    # Fall back to session auth (for browsable API / test client)
    if request.user and request.user.is_authenticated:
        return request.user
    return None


def _auth_required(view_fn):
    """Decorator: return 401 if not authenticated via JWT or session."""
    def wrapper(request, *args, **kwargs):
        user = _jwt_user(request)
        if not user:
            return JsonResponse({'detail': 'Authentication credentials were not provided.'}, status=401)
        request.auth_user = user
        return view_fn(request, *args, **kwargs)
    wrapper.__name__ = view_fn.__name__
    return wrapper


@require_GET
@_auth_required
def export_students(request):
    start_date = request.GET.get('start_date')
    end_date = request.GET.get('end_date')
    fmt = request.GET.get('format', 'csv').lower()

    qs = Student.objects.select_related('user', 'grade_config', 'current_section')
    user = request.auth_user
    if getattr(user, 'user_type', '') != 'PLATFORM_ADMIN':
        school = _get_school(user)
        qs = qs.filter(school=school) if school else qs.none()
    if start_date and end_date:
        qs = qs.filter(created_at__date__gte=start_date, created_at__date__lte=end_date)
    qs = qs.order_by('user__first_name')

    if fmt == 'json':
        data = [{'suid': s.suid, 'admission_number': s.admission_number,
                 'full_name': s.full_name_display, 'email': s.user.email,
                 'gender': s.gender,
                 'grade': s.grade_config.grade_name if s.grade_config else '',
                 'section': str(s.current_section) if s.current_section else '',
                 'status': s.status,
                 'admission_date': str(s.admission_date) if s.admission_date else ''} for s in qs]
        return JsonResponse(data, safe=False)

    headers = ['SUID', 'Admission No', 'Full Name', 'Email', 'Gender', 'Grade', 'Section', 'Status', 'Admission Date']
    data_rows = []
    for s in qs:
        data_rows.append([
            s.suid, s.admission_number or '', s.full_name_display, s.user.email,
            s.gender, s.grade_config.grade_name if s.grade_config else '',
            str(s.current_section) if s.current_section else '', s.status, s.admission_date or ''
        ])

    label = f"students_{start_date}_to_{end_date}" if start_date else "students_all"
    
    if fmt == 'pdf':
        title = f"Students Report ({start_date} to {end_date})" if start_date else "Students Report (All)"
        return _generate_pdf_response(label, title, headers, data_rows)

    resp = HttpResponse(content_type='text/csv')
    resp['Content-Disposition'] = f'attachment; filename="{label}.csv"'
    w = csv.writer(resp)
    w.writerow(headers)
    w.writerows(data_rows)
    return resp


@require_GET
@_auth_required
def export_attendance(request):
    start_date = request.GET.get('start_date')
    end_date = request.GET.get('end_date')
    fmt = request.GET.get('format', 'csv').lower()

    if not start_date or not end_date:
        return JsonResponse({'error': 'start_date and end_date are required'}, status=400)

    qs = StudentAttendance.objects.select_related('student', 'student__user', 'session').filter(
        session__date__gte=start_date, session__date__lte=end_date)
    user = request.auth_user
    if getattr(user, 'user_type', '') != 'PLATFORM_ADMIN':
        school = _get_school(user)
        qs = qs.filter(student__school=school) if school else qs.none()
    qs = qs.order_by('session__date', 'student__user__first_name')

    if fmt == 'json':
        data = [{'date': str(r.session.date), 'student': r.student.full_name_display,
                 'suid': r.student.suid, 'status': r.status, 'remarks': r.remarks or ''} for r in qs]
        return JsonResponse(data, safe=False)

    headers = ['Date', 'Student Name', 'SUID', 'Status', 'Remarks']
    data_rows = []
    for r in qs:
        data_rows.append([
            r.session.date, r.student.full_name_display, r.student.suid, r.status, r.remarks or ''
        ])

    label = f"attendance_{start_date}_to_{end_date}"
    if fmt == 'pdf':
        title = f"Attendance Report ({start_date} to {end_date})"
        return _generate_pdf_response(label, title, headers, data_rows)

    resp = HttpResponse(content_type='text/csv')
    resp['Content-Disposition'] = f'attachment; filename="{label}.csv"'
    w = csv.writer(resp)
    w.writerow(headers)
    w.writerows(data_rows)
    return resp


@require_GET
@_auth_required
def export_finance(request):
    start_date = request.GET.get('start_date')
    end_date = request.GET.get('end_date')
    fmt = request.GET.get('format', 'csv').lower()

    if not start_date or not end_date:
        return JsonResponse({'error': 'start_date and end_date are required'}, status=400)

    qs = Invoice.objects.select_related('student', 'student__user').filter(
        created_at__date__gte=start_date, created_at__date__lte=end_date)
    user = request.auth_user
    if getattr(user, 'user_type', '') != 'PLATFORM_ADMIN':
        school = _get_school(user)
        qs = qs.filter(student__school=school) if school else qs.none()
    qs = qs.order_by('-created_at')

    if fmt == 'json':
        data = [{'invoice_number': inv.invoice_number, 'date': str(inv.created_at.date()),
                 'student': inv.student.full_name_display if inv.student else '',
                 'suid': inv.student.suid if inv.student else '',
                 'total_amount': str(inv.total_amount), 'paid_amount': str(inv.paid_amount),
                 'balance_due': str(inv.balance_due), 'status': inv.status,
                 'due_date': str(inv.due_date) if inv.due_date else ''} for inv in qs]
        return JsonResponse(data, safe=False)

    headers = ['Invoice No', 'Date', 'Student Name', 'SUID', 'Total Amount', 'Paid Amount', 'Balance Due', 'Status', 'Due Date']
    data_rows = []
    for inv in qs:
        data_rows.append([
            inv.invoice_number, inv.created_at.date(),
            inv.student.full_name_display if inv.student else '',
            inv.student.suid if inv.student else '',
            inv.total_amount, inv.paid_amount, inv.balance_due, inv.status,
            inv.due_date or ''
        ])

    label = f"financial_{start_date}_to_{end_date}"
    if fmt == 'pdf':
        title = f"Financial Report ({start_date} to {end_date})"
        return _generate_pdf_response(label, title, headers, data_rows)

    resp = HttpResponse(content_type='text/csv')
    resp['Content-Disposition'] = f'attachment; filename="{label}.csv"'
    w = csv.writer(resp)
    w.writerow(headers)
    w.writerows(data_rows)
    return resp


@require_GET
@_auth_required
def export_achievements(request):
    start_date = request.GET.get('start_date')
    end_date = request.GET.get('end_date')
    fmt = request.GET.get('format', 'csv').lower()

    if not start_date or not end_date:
        return JsonResponse({'error': 'start_date and end_date are required'}, status=400)

    qs = StudentYearlyAward.objects.select_related('student', 'student__user').filter(
        event_date__gte=start_date, event_date__lte=end_date)
    user = request.auth_user
    if getattr(user, 'user_type', '') != 'PLATFORM_ADMIN':
        school = _get_school(user)
        qs = qs.filter(student__school=school) if school else qs.none()
    qs = qs.order_by('-event_date')

    if fmt == 'json':
        data = [{'date': str(a.event_date) if a.event_date else '',
                 'student': a.student.full_name_display if a.student else '',
                 'suid': a.student.suid if a.student else '',
                 'title': a.title, 'category': a.category,
                 'level': a.level, 'description': a.description or ''} for a in qs]
        return JsonResponse(data, safe=False)

    headers = ['Date', 'Student Name', 'SUID', 'Award/Achievement', 'Category', 'Level', 'Description']
    data_rows = []
    for a in qs:
        data_rows.append([
            a.event_date or '', a.student.full_name_display if a.student else '',
            a.student.suid if a.student else '',
            a.title, a.category, a.level, a.description or ''
        ])

    label = f"achievements_{start_date}_to_{end_date}"
    if fmt == 'pdf':
        title = f"Achievements Report ({start_date} to {end_date})"
        return _generate_pdf_response(label, title, headers, data_rows)

    resp = HttpResponse(content_type='text/csv')
    resp['Content-Disposition'] = f'attachment; filename="{label}.csv"'
    w = csv.writer(resp)
    w.writerow(headers)
    w.writerows(data_rows)
    return resp
