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
from apps.achievements.models import StudentYearlyAward, Achievement

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
def _get_grade_variations(grade_param):
    if not grade_param:
        return []
    g_raw = str(grade_param).strip()
    g_clean = g_raw.lower().replace('grade', '').strip()
    g_full = f"Grade {g_clean}"
    return list(set([g_raw, g_clean, g_full, g_raw.lower(), g_raw.upper(), g_clean.upper()]))

def _get_section_variations(section_param):
    if not section_param:
        return []
    s_raw = str(section_param).strip()
    s_clean = s_raw.lower().replace('section', '').strip().upper()
    s_full = f"Section {s_clean}"
    return list(set([s_raw, s_clean, s_full, s_raw.lower(), s_raw.upper(), s_clean.lower()]))


@require_GET
@_auth_required
def export_students(request):
    start_date = request.GET.get('start_date')
    end_date = request.GET.get('end_date')
    fmt = request.GET.get('format', 'csv').lower()
    grade_param = request.GET.get('grade', '').strip()
    section_param = request.GET.get('section', '').strip()

    g_vars = _get_grade_variations(grade_param)
    s_vars = _get_section_variations(section_param)

    from django.db.models import Q
    qs = Student.objects.select_related('user', 'grade_config', 'current_section')
    user = request.auth_user
    if getattr(user, 'user_type', '') != 'PLATFORM_ADMIN':
        school = _get_school(user)
        qs = qs.filter(school=school) if school else qs.none()

    if start_date and end_date:
        qs = qs.filter(created_at__date__gte=start_date, created_at__date__lte=end_date)

    if g_vars:
        qs = qs.filter(
            Q(grade_config__grade_name__in=g_vars) |
            Q(enrollments__grade__in=g_vars)
        ).distinct()

    if s_vars:
        qs = qs.filter(
            Q(current_section__section_letter__in=s_vars) |
            Q(enrollments__section__in=s_vars)
        ).distinct()

    qs = qs.order_by('user__first_name')

    if fmt == 'json':
        data = [{'suid': s.suid, 'admission_number': s.admission_number,
                 'full_name': s.full_name_display, 'email': s.user.email,
                 'gender': s.gender,
                 'grade': s.grade_config.grade_name if s.grade_config else '',
                 'section': str(s.current_section.section_letter) if s.current_section else '',
                 'status': s.status,
                 'admission_date': str(s.admission_date) if s.admission_date else ''} for s in qs]
        return JsonResponse(data, safe=False)

    headers = ['SUID', 'Admission No', 'Full Name', 'Email', 'Gender', 'Grade', 'Section', 'Status', 'Admission Date']
    data_rows = []
    for s in qs:
        data_rows.append([
            s.suid, s.admission_number or '', s.full_name_display, s.user.email,
            s.gender, s.grade_config.grade_name if s.grade_config else '',
            s.current_section.section_letter if s.current_section else '', s.status, s.admission_date or ''
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
    grade_param = request.GET.get('grade', '').strip()
    section_param = request.GET.get('section', '').strip()

    g_vars = _get_grade_variations(grade_param)
    s_vars = _get_section_variations(section_param)

    user = request.auth_user
    school = None
    from apps.core.school_isolation import get_user_school
    school = get_user_school(user) or _get_school(user)
    if getattr(user, 'user_type', '') == 'PLATFORM_ADMIN' or getattr(user, 'is_superuser', False):
        school_id = request.GET.get('school') or request.GET.get('school_id')
        if school_id:
            from apps.schools.models import School
            school = School.objects.filter(id=school_id).first()

    from django.db.models import Q
    from apps.students.models import Student
    from apps.attendance.models import StudentAttendance
    from apps.schools.models_calendar import Holiday

    student_qs = Student.objects.select_related(
        'school', 'user', 'grade_config', 'current_section'
    ).prefetch_related('enrollments')

    if school:
        student_qs = student_qs.filter(school=school)
    elif getattr(user, 'user_type', '') != 'PLATFORM_ADMIN' and not getattr(user, 'is_superuser', False):
        student_qs = student_qs.none()

    if hasattr(Student, 'status'):
        student_qs = student_qs.filter(status__in=['ACTIVE', 'TEMPORARY', 'ENROLLED', 'PROMOTED'])

    if g_vars:
        student_qs = student_qs.filter(
            Q(grade_config__grade_name__in=g_vars) |
            Q(enrollments__grade__in=g_vars)
        ).distinct()

    if s_vars:
        student_qs = student_qs.filter(
            Q(current_section__section_letter__in=s_vars) |
            Q(enrollments__section__in=s_vars)
        ).distinct()

    student_qs = student_qs.order_by('user__first_name', 'user__last_name', 'suid')

    # Pre-calculate overall attendance percentage for each student
    student_ids = list(student_qs.values_list('id', flat=True))

    holiday_dates = Holiday.objects.filter(school=school).values_list('date', flat=True) if school else Holiday.objects.values_list('date', flat=True)

    all_records = StudentAttendance.objects.filter(
        student_id__in=student_ids,
        session__is_locked=True
    ).exclude(session__date__week_day=1).exclude(session__date__in=holiday_dates)

    student_stats = {sid: {'present': 0, 'total': 0} for sid in student_ids}
    for rec in all_records:
        sid = rec.student_id
        if sid in student_stats:
            student_stats[sid]['total'] += 1
            if rec.status in ['PRESENT', 'LATE']:
                student_stats[sid]['present'] += 1

    student_percentages = {}
    for sid, stats in student_stats.items():
        if stats['total'] > 0:
            pct = round((stats['present'] / stats['total']) * 100.0, 2)
        else:
            pct = 100.0
        student_percentages[sid] = f"{pct}%"

    headers = ['Name', 'Grade', 'Section', 'Student Name', 'SUID', 'Attendance (%)']
    data_rows = []
    for s in student_qs:
        school_name = s.school.name if s.school else (school.name if school else '')
        
        grade_str = ''
        section_str = ''
        active_enrollment = s.enrollments.filter(status__in=['ACTIVE', 'TEMPORARY', 'PROMOTED']).first()
        if active_enrollment:
            grade_str = str(active_enrollment.grade)
            section_str = str(active_enrollment.section)
        else:
            if s.grade_config:
                grade_str = str(s.grade_config.grade_name)
            if s.current_section:
                section_str = str(s.current_section.section_letter)
                if not grade_str and hasattr(s.current_section, 'grade') and s.current_section.grade:
                    grade_str = str(s.current_section.grade.name)

        student_name = s.full_name_display or (s.user.full_name if s.user else s.suid)
        suid = s.suid or ''
        att_pct = student_percentages.get(s.id, '100.0%')

        data_rows.append([
            school_name,
            grade_str,
            section_str,
            student_name,
            suid,
            att_pct
        ])

    if fmt == 'json':
        data = [{
            'Name': r[0],
            'Grade': r[1],
            'Section': r[2],
            'Student Name': r[3],
            'SUID': r[4],
            'Attendance (%)': r[5]
        } for r in data_rows]
        return JsonResponse(data, safe=False)

    label = f"attendance_report_{school.code if (school and school.code) else 'school'}"
    if start_date and end_date:
        label = f"attendance_{start_date}_to_{end_date}"
        title = f"Attendance Report ({start_date} to {end_date})"
    else:
        title = "Attendance Report"

    if fmt == 'pdf':
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
    grade_param = request.GET.get('grade', '').strip()
    section_param = request.GET.get('section', '').strip()

    g_vars = _get_grade_variations(grade_param)
    s_vars = _get_section_variations(section_param)

    if not start_date or not end_date:
        return JsonResponse({'error': 'start_date and end_date are required'}, status=400)

    user = request.auth_user
    school = None
    if getattr(user, 'user_type', '') != 'PLATFORM_ADMIN':
        school = _get_school(user)

    from apps.schools.models_settings import SchoolSettings
    from django.db.models import Q

    school_settings = SchoolSettings.objects.filter(school=school).first() if school else None
    show_breakdown = getattr(school_settings, 'show_fee_breakdown_on_invoice', False)

    qs = Invoice.objects.select_related(
        'student', 'student__user', 'student__grade_config', 'student__current_section'
    ).filter(created_at__date__gte=start_date, created_at__date__lte=end_date)
    
    if school:
        qs = qs.filter(student__school=school)
    elif getattr(user, 'user_type', '') != 'PLATFORM_ADMIN':
        qs = qs.none()

    if g_vars:
        qs = qs.filter(
            Q(student__grade_config__grade_name__in=g_vars) |
            Q(student__enrollments__grade__in=g_vars)
        ).distinct()

    if s_vars:
        qs = qs.filter(
            Q(student__current_section__section_letter__in=s_vars) |
            Q(student__enrollments__section__in=s_vars)
        ).distinct()

    if show_breakdown:
        qs = qs.prefetch_related('items', 'categories').select_related(
            'fee_assignment', 'fee_assignment__fee_structure', 'fee_assignment__fee_schedule'
        )

    qs = qs.order_by('-created_at')

    from decimal import Decimal

    if fmt == 'json':
        data = []
        for inv in qs:
            grade_str = inv.student.grade_config.grade_name if (inv.student and inv.student.grade_config) else ''
            section_str = inv.student.current_section.section_letter if (inv.student and inv.student.current_section) else ''
            item_data = {
                'invoice_number': inv.invoice_number, 
                'date': str(inv.created_at.date()),
                'grade': grade_str,
                'section': section_str,
                'student': inv.student.full_name_display if inv.student else '',
                'suid': inv.student.suid if inv.student else '',
                'total_amount': str(inv.total_amount), 
                'paid_amount': str(inv.paid_amount),
                'balance_due': str(inv.balance_due), 
                'status': inv.status,
                'due_date': str(inv.due_date) if inv.due_date else ''
            }
            if show_breakdown:
                items_list = inv.items.all()
                if items_list.exists():
                    breakdown_str = "; ".join([f"{item.description}: Rs.{item.net_amount}" for item in items_list])
                elif inv.categories.exists():
                    breakdown_str = "; ".join([f"{cat.name}: Rs.{cat.amount}" for cat in inv.categories.all()])
                elif inv.fee_assignment and inv.fee_assignment.fee_structure:
                    structure = inv.fee_assignment.fee_structure
                    installments_count = inv.fee_assignment.fee_schedule.installments_per_year if inv.fee_assignment.fee_schedule else 1
                    if installments_count <= 0:
                        installments_count = 1
                    
                    components = [
                        ('Tuition Fee', structure.tuition_fee),
                        ('Admission Fee', structure.admission_fee),
                        ('Exam Fee', structure.exam_fee),
                        ('Lab Fee', structure.lab_fee),
                        ('Library Fee', structure.library_fee),
                        ('Sports Fee', structure.sports_fee),
                        ('Computer Fee', structure.computer_fee),
                        ('Transport Fee', structure.transport_fee),
                        ('Miscellaneous Fee', structure.misc_fee),
                        ('Development Fee', structure.development_fee),
                    ]
                    items_breakdown = []
                    for label, val in components:
                        if val > 0:
                            installment_val = val / Decimal(str(installments_count))
                            items_breakdown.append(f"{label}: Rs.{installment_val:.2f}")
                    
                    if inv.fee_assignment.scholarship_percentage > 0:
                        discount_val = (structure.total_annual_fee * (inv.fee_assignment.scholarship_percentage / Decimal('100'))) / Decimal(str(installments_count))
                        items_breakdown.append(f"Scholarship Discount: -Rs.{discount_val:.2f}")
                    if inv.fee_assignment.sibling_discount > 0:
                        discount_val = inv.fee_assignment.sibling_discount / Decimal(str(installments_count))
                        items_breakdown.append(f"Sibling Discount: -Rs.{discount_val:.2f}")
                    if inv.fee_assignment.special_discount > 0:
                        discount_val = inv.fee_assignment.special_discount / Decimal(str(installments_count))
                        items_breakdown.append(f"Special Discount: -Rs.{discount_val:.2f}")
                    if inv.fee_assignment.additional_fee > 0:
                        additional_val = inv.fee_assignment.additional_fee / Decimal(str(installments_count))
                        items_breakdown.append(f"Additional Fee: Rs.{additional_val:.2f}")
                    
                    if inv.late_fee > 0:
                        items_breakdown.append(f"Late Fee: Rs.{inv.late_fee:.2f}")
                        
                    breakdown_str = "; ".join(items_breakdown) if items_breakdown else "-"
                else:
                    breakdown_str = "-"
                item_data['fee_breakdown'] = breakdown_str
            data.append(item_data)
        return JsonResponse(data, safe=False)

    if show_breakdown:
        headers = ['Invoice No', 'Date', 'Grade', 'Section', 'Student Name', 'SUID', 'Fee Breakdown', 'Total Amount', 'Paid Amount', 'Balance Due', 'Status', 'Due Date']
    else:
        headers = ['Invoice No', 'Date', 'Grade', 'Section', 'Student Name', 'SUID', 'Total Amount', 'Paid Amount', 'Balance Due', 'Status', 'Due Date']

    data_rows = []
    for inv in qs:
        grade_str = inv.student.grade_config.grade_name if (inv.student and inv.student.grade_config) else ''
        section_str = inv.student.current_section.section_letter if (inv.student and inv.student.current_section) else ''
        row = [
            inv.invoice_number, 
            inv.created_at.date(),
            grade_str,
            section_str,
            inv.student.full_name_display if inv.student else '',
            inv.student.suid if inv.student else '',
        ]
        if show_breakdown:
            items_list = inv.items.all()
            if items_list.exists():
                breakdown_str = "; ".join([f"{item.description}: Rs.{item.net_amount}" for item in items_list])
            elif inv.categories.exists():
                breakdown_str = "; ".join([f"{cat.name}: Rs.{cat.amount}" for cat in inv.categories.all()])
            elif inv.fee_assignment and inv.fee_assignment.fee_structure:
                structure = inv.fee_assignment.fee_structure
                installments_count = inv.fee_assignment.fee_schedule.installments_per_year if inv.fee_assignment.fee_schedule else 1
                if installments_count <= 0:
                    installments_count = 1
                
                components = [
                    ('Tuition Fee', structure.tuition_fee),
                    ('Admission Fee', structure.admission_fee),
                    ('Exam Fee', structure.exam_fee),
                    ('Lab Fee', structure.lab_fee),
                    ('Library Fee', structure.library_fee),
                    ('Sports Fee', structure.sports_fee),
                    ('Computer Fee', structure.computer_fee),
                    ('Transport Fee', structure.transport_fee),
                    ('Miscellaneous Fee', structure.misc_fee),
                    ('Development Fee', structure.development_fee),
                ]
                items_breakdown = []
                for label, val in components:
                    if val > 0:
                        installment_val = val / Decimal(str(installments_count))
                        items_breakdown.append(f"{label}: Rs.{installment_val:.2f}")
                
                if inv.fee_assignment.scholarship_percentage > 0:
                    discount_val = (structure.total_annual_fee * (inv.fee_assignment.scholarship_percentage / Decimal('100'))) / Decimal(str(installments_count))
                    items_breakdown.append(f"Scholarship Discount: -Rs.{discount_val:.2f}")
                if inv.fee_assignment.sibling_discount > 0:
                    discount_val = inv.fee_assignment.sibling_discount / Decimal(str(installments_count))
                    items_breakdown.append(f"Sibling Discount: -Rs.{discount_val:.2f}")
                if inv.fee_assignment.special_discount > 0:
                    discount_val = inv.fee_assignment.special_discount / Decimal(str(installments_count))
                    items_breakdown.append(f"Special Discount: -Rs.{discount_val:.2f}")
                if inv.fee_assignment.additional_fee > 0:
                    additional_val = inv.fee_assignment.additional_fee / Decimal(str(installments_count))
                    items_breakdown.append(f"Additional Fee: Rs.{additional_val:.2f}")
                
                if inv.late_fee > 0:
                    items_breakdown.append(f"Late Fee: Rs.{inv.late_fee:.2f}")
                    
                breakdown_str = "; ".join(items_breakdown) if items_breakdown else "-"
            else:
                breakdown_str = "-"
            row.append(breakdown_str)
            
        row.extend([
            inv.total_amount, 
            inv.paid_amount, 
            inv.balance_due, 
            inv.status,
            inv.due_date or ''
        ])
        data_rows.append(row)

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
    grade_param = request.GET.get('grade', '').strip()
    section_param = request.GET.get('section', '').strip()

    g_vars = _get_grade_variations(grade_param)
    s_vars = _get_section_variations(section_param)

    user = request.auth_user
    school = None
    if getattr(user, 'user_type', '') != 'PLATFORM_ADMIN':
        school = _get_school(user)

    from django.db.models import Q

    # Query 1: StudentYearlyAward entries
    award_qs = StudentYearlyAward.objects.select_related(
        'student', 'student__user', 'student__grade_config', 'student__current_section'
    )
    if school:
        award_qs = award_qs.filter(student__school=school)
    elif getattr(user, 'user_type', '') != 'PLATFORM_ADMIN':
        award_qs = award_qs.none()

    if start_date and end_date:
        award_qs = award_qs.filter(
            Q(event_date__gte=start_date, event_date__lte=end_date) |
            Q(event_date__isnull=True, created_at__date__gte=start_date, created_at__date__lte=end_date)
        )

    if g_vars:
        award_qs = award_qs.filter(
            Q(student__grade_config__grade_name__in=g_vars) |
            Q(student__enrollments__grade__in=g_vars)
        ).distinct()

    if s_vars:
        award_qs = award_qs.filter(
            Q(student__current_section__section_letter__in=s_vars) |
            Q(student__enrollments__section__in=s_vars)
        ).distinct()

    # Query 2: Achievement entries
    ach_qs = Achievement.objects.select_related(
        'student', 'student__student', 'student__student__user',
        'student__student__grade_config', 'student__student__current_section'
    )
    if school:
        ach_qs = ach_qs.filter(student__school=school)
    elif getattr(user, 'user_type', '') != 'PLATFORM_ADMIN':
        ach_qs = ach_qs.none()

    if start_date and end_date:
        ach_qs = ach_qs.filter(date_awarded__gte=start_date, date_awarded__lte=end_date)

    if g_vars:
        ach_qs = ach_qs.filter(
            Q(grade__in=g_vars) |
            Q(student__grade__in=g_vars) |
            Q(student__student__grade_config__grade_name__in=g_vars)
        ).distinct()

    if s_vars:
        ach_qs = ach_qs.filter(
            Q(student__section__in=s_vars) |
            Q(student__student__current_section__section_letter__in=s_vars)
        ).distinct()

    combined_list = []

    for a in award_qs:
        st = a.student
        dt = str(a.event_date) if a.event_date else str(a.created_at.date())
        g_name = st.grade_config.grade_name if (st and st.grade_config) else ''
        sec_letter = st.current_section.section_letter if (st and st.current_section) else ''
        cat_display = a.get_category_display() if hasattr(a, 'get_category_display') else a.category
        level_display = a.get_level_display() if hasattr(a, 'get_level_display') else a.level
        combined_list.append({
            'date': dt,
            'grade': g_name,
            'section': sec_letter,
            'student_name': st.full_name_display if st else 'N/A',
            'suid': st.suid if st else 'N/A',
            'title': a.title,
            'category': cat_display,
            'level': level_display,
            'description': a.description or ''
        })

    for ach in ach_qs:
        st = ach.student.student if (ach.student and hasattr(ach.student, 'student')) else None
        dt = str(ach.date_awarded) if ach.date_awarded else ''
        g_name = ach.grade or (ach.student.grade if ach.student else '') or (st.grade_config.grade_name if (st and st.grade_config) else '')
        sec_letter = (ach.student.section if ach.student else '') or (st.current_section.section_letter if (st and st.current_section) else '')
        cat_display = ach.get_category_display() if hasattr(ach, 'get_category_display') else ach.category
        combined_list.append({
            'date': dt,
            'grade': g_name,
            'section': sec_letter,
            'student_name': st.full_name_display if st else 'N/A',
            'suid': st.suid if st else 'N/A',
            'title': ach.title,
            'category': cat_display,
            'level': 'SCHOOL',
            'description': ach.description or ''
        })

    # Extra safety: Python level filtering with normalized grade & section checks
    if g_vars:
        combined_list = [
            item for item in combined_list
            if any(str(item['grade']).strip().lower().replace('grade', '').strip() == v.lower().replace('grade', '').strip() for v in g_vars)
        ]

    if s_vars:
        combined_list = [
            item for item in combined_list
            if any(str(item['section']).strip().lower().replace('section', '').strip() == v.lower().replace('section', '').strip() for v in s_vars)
        ]

    combined_list.sort(key=lambda x: x['date'], reverse=True)

    if fmt == 'json':
        return JsonResponse(combined_list, safe=False)

    headers = ['Date', 'Grade', 'Section', 'Student Name', 'SUID', 'Award/Achievement', 'Category', 'Level', 'Description']
    data_rows = []
    for item in combined_list:
        data_rows.append([
            item['date'],
            item['grade'],
            item['section'],
            item['student_name'],
            item['suid'],
            item['title'],
            item['category'],
            item['level'],
            item['description']
        ])

    label = f"achievements_{start_date}_to_{end_date}" if start_date and end_date else "achievements_all"
    if fmt == 'pdf':
        title = f"Achievements Report ({start_date} to {end_date})" if start_date and end_date else "Achievements Report"
        return _generate_pdf_response(label, title, headers, data_rows)

    resp = HttpResponse(content_type='text/csv')
    resp['Content-Disposition'] = f'attachment; filename="{label}.csv"'
    w = csv.writer(resp)
    w.writerow(headers)
    w.writerows(data_rows)
    return resp
