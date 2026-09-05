from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django.utils import timezone

# Import models to listen to
from apps.academics.models_result_system import StudentMark
from apps.discipline.models import DisciplineRecord, KarmaActivity, StudentKarma
from apps.achievements.models import Achievement, StudentYearlyAward
from apps.health.models import ClinicVisit
from apps.enrollments.models import StudentEnrollment
from apps.attendance.models import StudentAttendance
from apps.academics.models import Result


@receiver(post_save, sender=StudentMark)
def sync_timeline_mark(sender, instance, **kwargs):
    """Sync StudentMark entries to TimelineMark."""
    try:
        from apps.timeline.models import TimelineMark
        student = instance.student
        grade_name = instance.exam.grade.grade_name if instance.exam.grade else 'Unknown'
        
        # Calculate attendance percentage
        from apps.schools.models_calendar import Holiday
        holiday_dates = Holiday.objects.filter(school=student.school).values_list('date', flat=True)
        attendance_records = StudentAttendance.objects.filter(student=student, session__grade=grade_name).exclude(
            session__date__week_day=1
        ).exclude(
            session__date__in=holiday_dates
        )
        total_days = attendance_records.count()
        present_days = attendance_records.filter(status__in=['PRESENT', 'LATE']).count()
        percentage = (present_days / total_days * 100) if total_days > 0 else 0.0
        
        TimelineMark.objects.update_or_create(
            student_global_id=student.suid,
            subject=instance.exam.subject.name,
            exam_name=instance.exam.term.term_name,
            grade=grade_name,
            defaults={
                'marks_obtained': instance.marks_obtained,
                'total_marks': instance.exam.total_marks,
                'passing_marks': instance.exam.passing_marks,
                'is_pass': instance.is_pass,
                'is_absent': instance.is_absent,
                'attendance_percentage': percentage,
                'days_present': present_days,
                'total_days': total_days,
            }
        )
    except Exception as e:
        print(f"ERROR syncing mark to timeline: {e}")


@receiver(post_save, sender=DisciplineRecord)
def sync_timeline_discipline(sender, instance, **kwargs):
    """Sync DisciplineRecord entries to TimelineRemark."""
    try:
        from apps.timeline.models import TimelineRemark
        student = instance.student
        current_enrollment = student.enrollments.filter(status='ACTIVE').first()
        grade_name = getattr(instance, 'grade', None) or (current_enrollment.grade if current_enrollment else 'Unknown')
        
        teacher_name = 'Unknown'
        if instance.reported_by:
            teacher_name = instance.reported_by.get_full_name() or getattr(instance.reported_by, 'username', None) or instance.reported_by.email
            
        TimelineRemark.objects.create(
            student_global_id=student.suid,
            grade=grade_name,
            record_type='DISCIPLINE',
            title=instance.category,
            description=instance.description,
            points=-instance.points_deducted,
            teacher_name=teacher_name
        )
    except Exception as e:
        print(f"ERROR syncing discipline to timeline: {e}")


@receiver(post_save, sender=KarmaActivity)
def sync_timeline_karma_activity(sender, instance, **kwargs):
    """Sync KarmaActivity entries to TimelineRemark."""
    try:
        from apps.timeline.models import TimelineRemark
        student = instance.student
        current_enrollment = student.enrollments.filter(status='ACTIVE').first()
        grade_name = getattr(instance, 'grade', None) or (current_enrollment.grade if current_enrollment else 'Unknown')
        
        teacher_name = 'Unknown'
        if instance.awarded_by:
            teacher_name = instance.awarded_by.get_full_name() or getattr(instance.awarded_by, 'username', None) or instance.awarded_by.email
            
        TimelineRemark.objects.create(
            student_global_id=student.suid,
            grade=grade_name,
            record_type='KARMA',
            title=instance.title,
            description=instance.description or '',
            points=instance.points,
            teacher_name=teacher_name
        )
    except Exception as e:
        print(f"ERROR syncing karma activity to timeline: {e}")


@receiver(post_save, sender=StudentKarma)
def sync_timeline_student_karma(sender, instance, **kwargs):
    """Sync StudentKarma entries to TimelineRemark."""
    try:
        from apps.timeline.models import TimelineRemark
        student = instance.student
        
        teacher_name = 'Unknown'
        if instance.given_by_teacher:
            teacher_name = getattr(instance.given_by_teacher, 'full_name_display', None) or \
                           (instance.given_by_teacher.user.get_full_name() if instance.given_by_teacher.user else 'Unknown')
                           
        points_val = instance.points if instance.type == 'POSITIVE' else -instance.points
        
        TimelineRemark.objects.create(
            student_global_id=student.suid,
            grade=instance.grade,
            record_type='KARMA',
            title=f"{instance.category} ({instance.type})",
            description=instance.remark,
            points=points_val,
            teacher_name=teacher_name
        )
    except Exception as e:
        print(f"ERROR syncing student karma to timeline: {e}")


@receiver(post_save, sender=Achievement)
def sync_timeline_achievement(sender, instance, **kwargs):
    """Sync Achievement entries to TimelineRemark."""
    try:
        from apps.timeline.models import TimelineRemark
        enrollment = instance.student
        student = enrollment.student
        
        TimelineRemark.objects.create(
            student_global_id=student.suid,
            grade=getattr(instance, 'grade', None) or enrollment.grade,
            record_type='ACHIEVEMENT',
            title=instance.title,
            description=instance.description,
            points=None,
            teacher_name='School Administrator'
        )
    except Exception as e:
        print(f"ERROR syncing achievement to timeline: {e}")


@receiver(post_save, sender=StudentYearlyAward)
def sync_timeline_yearly_award(sender, instance, **kwargs):
    """Sync StudentYearlyAward entries to TimelineRemark."""
    try:
        from apps.timeline.models import TimelineRemark
        student = instance.student
        grade_name = 'Unknown'
        if instance.student_history:
            grade_name = instance.student_history.grade_name or 'Unknown'
        else:
            current_enrollment = student.enrollments.filter(status='ACTIVE').first()
            if current_enrollment:
                grade_name = current_enrollment.grade
                
        teacher_name = instance.awarded_by or 'School Administrator'
        
        TimelineRemark.objects.create(
            student_global_id=student.suid,
            grade=grade_name,
            record_type='AWARD',
            title=instance.title,
            description=instance.description,
            points=None,
            teacher_name=teacher_name
        )
    except Exception as e:
        print(f"ERROR syncing yearly award to timeline: {e}")


@receiver(post_save, sender=ClinicVisit)
def sync_timeline_health(sender, instance, **kwargs):
    """Sync ClinicVisit entries to TimelineHealth."""
    try:
        from apps.timeline.models import TimelineHealth
        student = instance.student
        nurse_name = 'Unknown'
        if instance.nurse:
            nurse_name = instance.nurse.get_full_name() or getattr(instance.nurse, 'username', None) or instance.nurse.email
            
        # Get student's current active grade
        grade_name = 'Unknown'
        active_enrollment = student.enrollments.filter(status='ACTIVE').first()
        if active_enrollment:
            grade_name = active_enrollment.grade
        elif student.grade_config:
            grade_name = student.grade_config.grade_name

        TimelineHealth.objects.create(
            student_global_id=student.suid,
            grade=grade_name,
            visit_date=instance.visit_date,
            symptom=instance.symptom,
            treatment_given=instance.treatment_given,
            sent_home=instance.sent_home,
            recorded_by=nurse_name
        )
    except Exception as e:
        print(f"ERROR syncing clinic visit to timeline: {e}")


@receiver(post_save, sender=StudentEnrollment)
def sync_enrollment_archive(sender, instance, **kwargs):
    """Archive student admission details and documents upon withdrawal, transfer or graduation, and sync status."""
    try:
        student = instance.student
        
        # Determine status value to sync to the Student model
        sync_status = instance.status
        if instance.status == 'COMPLETED':
            sync_status = 'GRADUATED'
            
        # Sync core student profile status to match
        if student.status != sync_status:
            student.status = sync_status
            student.save(update_fields=['status'])
    except Exception as e:
        print(f"ERROR syncing enrollment status to student: {e}")

    if instance.status in ['WITHDRAWN', 'INACTIVE', 'TRANSFERRED', 'GRADUATED', 'COMPLETED']:
        archive_status = 'WITHDRAWN' if instance.status in ['WITHDRAWN', 'INACTIVE'] else ('GRADUATED' if instance.status in ['GRADUATED', 'COMPLETED'] else 'TRANSFERRED')
        try:
            student = instance.student
            
            from apps.timeline.models import StudentEnrollmentArchive
            from apps.students.models_tenure import SchoolTenure

            # Deduplication Guard: Prevent creating duplicate archive records within 30 seconds for the same status
            from django.utils import timezone
            recent_archive = StudentEnrollmentArchive.objects.filter(
                student_global_id=student.suid,
                status=archive_status,
                school_name=instance.school.name,
                archived_at__gte=timezone.now() - timezone.timedelta(seconds=30)
            ).first()
            if recent_archive:
                print(f"DEBUG: Recent archive record already exists for SUID {student.suid} ({archive_status}). Skipping duplicate creation.")
                return

            # Check whether a prior GRADUATED SchoolTenure exists for this school.
            # This is set when the student previously graduated here and was re-admitted.
            prior_graduated_tenure = SchoolTenure.objects.filter(
                student_global_id=student.suid,
                school=instance.school,
                status='GRADUATED'
            ).first()

            # If the student is withdrawing/transferring after being re-admitted (and they
            # already have a GRADUATED tenure), do NOT create a new tenure or archive record.
            # The original GRADUATED record (e.g. Grade 1-10) must remain untouched.
            if archive_status in ('WITHDRAWN', 'TRANSFERRED') and prior_graduated_tenure:
                print(f"DEBUG: Re-admitted student {student.suid} is withdrawing/transferring. "
                      f"Leaving existing GRADUATED tenure intact. No new tenure created.")
                return
                
            # Compute and save final stats for current grade configuration in StudentHistory before archiving
            current_grade_config = student.grade_config
            if current_grade_config:
                from apps.attendance.models import StudentAttendance
                from apps.schools.models_calendar import Holiday
                from apps.academics.models_result_system import StudentMark
                from apps.discipline.models import StudentKarma
                from apps.students.models import StudentHistory

                # 1. Attendance stats
                holiday_dates = Holiday.objects.filter(school=student.school).values_list('date', flat=True)
                att_qs = StudentAttendance.objects.filter(
                    student=student,
                    session__grade=current_grade_config.grade_name
                ).exclude(
                    session__date__week_day=1
                ).exclude(
                    session__date__in=holiday_dates
                )

                total_working_days = att_qs.count()
                days_present = att_qs.filter(status__in=['PRESENT', 'LATE']).count()
                days_absent = att_qs.filter(status='ABSENT').count()
                days_late = att_qs.filter(status='LATE').count()
                attendance_pct = (days_present / total_working_days * 100) if total_working_days > 0 else 0.0

                # 2. Academic stats
                marks_records = StudentMark.objects.filter(
                    student=student,
                    exam__grade=current_grade_config
                )
                total_possible_marks = sum(r.exam.total_marks for r in marks_records if r.exam and r.exam.total_marks)
                total_obtained_marks = sum(r.marks_obtained for r in marks_records if r.marks_obtained)
                academic_pct = (float(total_obtained_marks) / float(total_possible_marks) * 100) if total_possible_marks > 0 else 0.0

                overall_grade = None
                if total_possible_marks > 0:
                    if academic_pct >= 90:
                        overall_grade = 'A+'
                    elif academic_pct >= 80:
                        overall_grade = 'A'
                    elif academic_pct >= 70:
                        overall_grade = 'B'
                    elif academic_pct >= 60:
                        overall_grade = 'C'
                    elif academic_pct >= 50:
                        overall_grade = 'D'
                    else:
                        overall_grade = 'F'

                # 3. Karma stats
                karma_qs = StudentKarma.objects.filter(
                    student=student,
                    grade=current_grade_config.grade_name
                )
                karma_earned = sum(r.points for r in karma_qs.filter(type='POSITIVE'))
                karma_deducted = sum(r.points for r in karma_qs.filter(type='NEGATIVE'))
                net_karma = karma_earned - karma_deducted

                current_year_code = instance.academic_year or '2025-2026'
                StudentHistory.objects.update_or_create(
                    student=student,
                    academic_year_name=current_year_code,
                    defaults={
                        'school': student.school,
                        'school_name': student.school.name,
                        'grade_name': current_grade_config.grade_name,
                        'section_name': instance.section,
                        'percentage': academic_pct if total_possible_marks > 0 else None,
                        'overall_grade': overall_grade,
                        'total_marks': total_obtained_marks if total_possible_marks > 0 else None,
                        'attendance_percentage': attendance_pct if total_working_days > 0 else None,
                        'total_working_days': total_working_days if total_working_days > 0 else None,
                        'days_present': days_present if total_working_days > 0 else None,
                        'days_absent': days_absent if total_working_days > 0 else None,
                        'days_late': days_late if total_working_days > 0 else None,
                        'karma_points_earned': karma_earned,
                        'karma_points_deducted': karma_deducted,
                        'net_karma': net_karma,
                        'promoted': False,
                        'promotion_remarks': f"Archived as {archive_status}",
                    }
                )

            # Serialize admission profile details
            profile_data = {
                'suid': student.suid,
                'first_name': student.user.first_name,
                'last_name': student.user.last_name,
                'email': student.user.email,
                'username': student.user.username,
                'admission_number': student.admission_number,
                'date_of_birth': str(student.date_of_birth) if student.date_of_birth else None,
                'gender': student.gender,
                'blood_group': student.blood_group,
                'medical_conditions': student.medical_conditions,
                'emergency_contact_name': student.emergency_contact_name,
                'emergency_contact_phone': student.emergency_contact_phone,
                'address_line1': student.address_line1,
                'address_line2': student.address_line2,
                'city': student.city,
                'state': student.state,
                'pincode': student.pincode,
                'admission_date': str(student.admission_date) if student.admission_date else None,
                'latitude': str(student.latitude) if student.latitude is not None else None,
                'longitude': str(student.longitude) if student.longitude is not None else None,
                'address': student.address,
                'category': student.category,
                'religion': student.religion,
                'mother_tongue': student.mother_tongue,
                'languages_known': student.languages_known,
                'nationality': student.nationality,
                'birth_place': student.birth_place,
                'is_rte_student': student.is_rte_student,
                'fee_concession_applicable': student.fee_concession_applicable,
                'fee_concession_amount': str(student.fee_concession_amount) if student.fee_concession_amount is not None else None,
                'house_color': student.house_color,
                'alumni_directory_consent': student.alumni_directory_consent,
                'aadhaar_number': student.aadhaar_number,
                'aadhaar_last_4_digits': student.aadhaar_last_4_digits,
                'apaar_id': student.apaar_id,
                'pen_id': student.pen_id,
                'dietary_preference': student.dietary_preference,
                'phone': student.phone,
            }
            
            # Serialize guardians
            guardians_list = []
            for g in student.guardians.all():
                guardians_list.append({
                    'name': g.name,
                    'relationship': g.relationship,
                    'phone': g.phone,
                    'email': g.email,
                    'occupation': g.occupation,
                    'workplace': g.workplace,
                    'annual_income': str(g.annual_income) if g.annual_income else None,
                    'is_primary': g.is_primary,
                    'can_pickup': g.can_pickup,
                })
            profile_data['guardians'] = guardians_list
            
            # Serialize document metadata
            documents_list = []
            for doc in student.documents.all():
                documents_list.append({
                    'title': doc.title,
                    'document_type': doc.document_type,
                    'file_url': doc.file.url if doc.file else None,
                    'academic_year': doc.academic_year,
                    'notes': doc.notes,
                    'uploaded_at': str(doc.uploaded_at) if doc.uploaded_at else None,
                })
                
            from apps.timeline.models import StudentEnrollmentArchive, TimelineMark, TimelineRemark, TimelineHealth
            
            # Serialize TimelineMark records
            marks_qs = TimelineMark.objects.filter(student_global_id=student.suid)
            serialized_marks = []
            for mark in marks_qs:
                serialized_marks.append({
                    'grade': mark.grade,
                    'subject': mark.subject,
                    'exam_name': mark.exam_name,
                    'marks_obtained': str(mark.marks_obtained) if mark.marks_obtained is not None else None,
                    'total_marks': str(mark.total_marks),
                    'passing_marks': str(mark.passing_marks),
                    'is_pass': mark.is_pass,
                    'is_absent': mark.is_absent,
                    'attendance_percentage': str(mark.attendance_percentage) if mark.attendance_percentage is not None else None,
                    'days_present': mark.days_present,
                    'total_days': mark.total_days,
                    'recorded_at': str(mark.recorded_at) if mark.recorded_at else None,
                })
                
            # Serialize TimelineRemark records
            remarks_qs = TimelineRemark.objects.filter(student_global_id=student.suid)
            serialized_remarks = []
            for rem in remarks_qs:
                serialized_remarks.append({
                    'grade': rem.grade,
                    'record_type': rem.record_type,
                    'title': rem.title,
                    'description': rem.description,
                    'points': rem.points,
                    'teacher_name': rem.teacher_name,
                    'recorded_at': str(rem.recorded_at) if rem.recorded_at else None,
                })
                
            # Serialize TimelineHealth records
            health_qs = TimelineHealth.objects.filter(student_global_id=student.suid)
            serialized_health = []
            for h in health_qs:
                serialized_health.append({
                    'grade': h.grade,
                    'visit_date': str(h.visit_date),
                    'symptom': h.symptom,
                    'treatment_given': h.treatment_given,
                    'sent_home': h.sent_home,
                    'recorded_by': h.recorded_by,
                    'recorded_at': str(h.recorded_at) if h.recorded_at else None,
                })

            # Serialize StudentHistory records
            from apps.students.models import StudentHistory
            history_qs = StudentHistory.objects.filter(student=student)
            serialized_history = []
            for h in history_qs:
                serialized_history.append({
                    'grade_name': h.grade_name,
                    'academic_year_name': h.academic_year_name,
                    'overall_grade': h.overall_grade,
                    'percentage': str(h.percentage) if h.percentage is not None else None,
                    'total_marks': str(h.total_marks) if h.total_marks is not None else None,
                    'attendance_percentage': str(h.attendance_percentage) if h.attendance_percentage is not None else None,
                    'total_working_days': h.total_working_days,
                    'days_present': h.days_present,
                    'days_absent': h.days_absent,
                    'days_late': h.days_late,
                    'karma_points_earned': h.karma_points_earned,
                    'karma_points_deducted': h.karma_points_deducted,
                    'net_karma': h.net_karma,
                    'promotion_remarks': h.promotion_remarks,
                    'promoted': h.promoted,
                })

            # Serialize ReportCard records
            from apps.academics.models import ReportCard
            report_cards_qs = ReportCard.objects.filter(student=student)
            serialized_report_cards = []
            for rc in report_cards_qs:
                serialized_report_cards.append({
                    'id': str(rc.id),
                    'term_name': rc.term_name,
                    'academic_year': rc.academic_year,
                    'grade_name': rc.section.grade_config.grade_name if rc.section and rc.section.grade_config else None,
                    'total_marks_obtained': str(rc.total_marks_obtained),
                    'total_marks_possible': str(rc.total_marks_possible),
                    'percentage': str(rc.percentage),
                    'grade_awarded': rc.grade_awarded,
                    'rank': rc.rank,
                    'remarks': rc.remarks,
                    'file_path': rc.file_path.url if rc.file_path else None,
                })
                
            # Build the new live timeline data (covers the current tenure's grades only)
            timeline_data = {
                'marks': serialized_marks,
                'remarks': serialized_remarks,
                'health': serialized_health,
                'history': serialized_history,
                'report_cards': serialized_report_cards
            }

            # --- CREATE/UPDATE SCHOOL TENURE RECORD ---
            # Look for the ACTIVE tenure first (created when student was re-admitted)
            active_tenure = SchoolTenure.objects.filter(
                student_global_id=student.suid,
                school=instance.school,
                status='ACTIVE'
            ).first()

            grades_histories = StudentHistory.objects.filter(
                student=student, school=instance.school
            ).order_by('academic_year_name')
            grade_from = grades_histories.first().grade_name or "" if grades_histories.exists() else ""
            grade_to   = grades_histories.last().grade_name  or "" if grades_histories.exists() else ""
            if not grade_from and current_grade_config:
                grade_from = current_grade_config.grade_name
            if not grade_to and current_grade_config:
                grade_to = current_grade_config.grade_name

            admitted_date = student.admission_date or timezone.now().date()

            if archive_status == 'GRADUATED' and prior_graduated_tenure:
                # ── RE-GRADUATION PATH ──────────────────────────────────────────
                # Merge the frozen snapshot from the previous tenure with the new
                # live data so the combined record covers Grade 1 through Grade 12.
                old_snap = prior_graduated_tenure.timeline_snapshot or {}
                merged_snapshot = {
                    'marks':        (old_snap.get('marks', []) or []) + serialized_marks,
                    'remarks':      (old_snap.get('remarks', []) or []) + serialized_remarks,
                    'health':       (old_snap.get('health', []) or []) + serialized_health,
                    'history':      (old_snap.get('history', []) or []) + serialized_history,
                    'report_cards': (old_snap.get('report_cards', []) or []) + serialized_report_cards,
                }
                # Keep the original grade_from (e.g. "1") — extend grade_to only
                prior_graduated_tenure.grade_to = grade_to or prior_graduated_tenure.grade_to
                prior_graduated_tenure.timeline_snapshot = merged_snapshot
                prior_graduated_tenure.profile_snapshot  = profile_data
                prior_graduated_tenure.transferred_date  = timezone.now().date()
                prior_graduated_tenure.save()
                print(f"DEBUG: Merged re-graduation snapshot into existing GRADUATED tenure "
                      f"for SUID {student.suid} (now covers Grade "
                      f"{prior_graduated_tenure.grade_from} → {prior_graduated_tenure.grade_to}).")

                # Remove the ACTIVE tenure that was created on re-admission (it is now
                # fully represented by the merged GRADUATED tenure above).
                if active_tenure:
                    active_tenure.delete()
            elif active_tenure:
                # ── FIRST-TIME GRADUATION (or non-graduating exit) ─────────────
                active_tenure.status = archive_status
                active_tenure.transferred_date = timezone.now().date()
                active_tenure.grade_from = active_tenure.grade_from or grade_from
                active_tenure.grade_to = grade_to or active_tenure.grade_to
                active_tenure.timeline_snapshot = timeline_data
                active_tenure.profile_snapshot = profile_data
                active_tenure.save()
            else:
                SchoolTenure.objects.create(
                    student_global_id=student.suid,
                    school=instance.school,
                    school_name=instance.school.name,
                    admitted_date=admitted_date,
                    transferred_date=timezone.now().date(),
                    grade_from=grade_from,
                    grade_to=grade_to,
                    status=archive_status,
                    timeline_snapshot=timeline_data,
                    profile_snapshot=profile_data
                )
            
            # Mark any prior archive records as re_admitted so future runs don't
            # hit a stale guard. Then create a fresh archive record for this event.
            StudentEnrollmentArchive.objects.filter(
                student_global_id=student.suid,
                re_admitted=False
            ).update(re_admitted=True)

            StudentEnrollmentArchive.objects.create(
                student_global_id=student.suid,
                status=archive_status,
                school_name=instance.school.name,
                admission_details=profile_data,
                documents=documents_list,
                timeline_data=timeline_data,
                transferred_date=timezone.now().date()
            )

            # Delete live timeline records now that they are frozen in the tenure snapshot
            marks_qs.delete()
            remarks_qs.delete()
            health_qs.delete()
            
            print(f"DEBUG: Successfully archived enrollment and moved timeline records for SUID {student.suid} to database table.")
        except Exception as e:
            print(f"ERROR archiving enrollment status: {e}")



@receiver([post_save, post_delete], sender=StudentAttendance)
def update_timeline_mark_attendance(sender, instance, **kwargs):
    """Update attendance percentage in TimelineMark whenever StudentAttendance is changed."""
    try:
        from apps.timeline.models import TimelineMark
        student = instance.student
        grade = instance.session.grade
        
        # Calculate attendance percentage
        from apps.schools.models_calendar import Holiday
        holiday_dates = Holiday.objects.filter(school=student.school).values_list('date', flat=True)
        attendance_records = StudentAttendance.objects.filter(student=student, session__grade=grade).exclude(
            session__date__week_day=1
        ).exclude(
            session__date__in=holiday_dates
        )
        total_days = attendance_records.count()
        present_days = attendance_records.filter(status__in=['PRESENT', 'LATE']).count()
        percentage = (present_days / total_days * 100) if total_days > 0 else 0.0
        
        # Update TimelineMark records
        TimelineMark.objects.filter(student_global_id=student.suid, grade=grade).update(
            attendance_percentage=percentage,
            days_present=present_days,
            total_days=total_days
        )
        print(f"DEBUG: Updated timeline attendance for SUID {student.suid} in Grade {grade}: {percentage}%")
    except Exception as e:
        print(f"ERROR updating timeline attendance: {e}")


@receiver(post_save, sender='students.Student')
def sync_student_status_to_enrollment(sender, instance, **kwargs):
    """Sync Student profile status changes to associated active/recent StudentEnrollments."""
    try:
        from apps.enrollments.models import StudentEnrollment
        target_status = instance.status
        
        # Prevent sync loops or invalid states
        enrollments = instance.enrollments.all()
        if instance.status in ['ACTIVE', 'TEMPORARY']:
            # Only update the latest enrollment's status to ACTIVE/TEMPORARY
            latest_enrollment = enrollments.order_by('-academic_year', '-enrollment_date').first()
            if latest_enrollment and latest_enrollment.status != target_status:
                latest_enrollment.status = target_status
                latest_enrollment.save(update_fields=['status'])
        else:
            # For WITHDRAWN, TRANSFERRED, GRADUATED, etc., update all enrollments that are currently ACTIVE or TEMPORARY
            for enrollment in enrollments:
                if enrollment.status in ['ACTIVE', 'TEMPORARY'] and enrollment.status != target_status:
                    enrollment.status = target_status
                    enrollment.save(update_fields=['status'])
    except Exception as e:
        print(f"ERROR syncing student status to enrollment: {e}")


@receiver(post_save, sender=Result)
def sync_timeline_result(sender, instance, **kwargs):
    """Sync Result entries to TimelineMark."""
    try:
        from apps.timeline.models import TimelineMark
        student = instance.student
        grade_name = instance.exam.section.grade_config.grade_name if (instance.exam.section and instance.exam.section.grade_config) else 'Unknown'
        
        # Calculate attendance percentage
        from apps.schools.models_calendar import Holiday
        holiday_dates = Holiday.objects.filter(school=student.school).values_list('date', flat=True)
        attendance_records = StudentAttendance.objects.filter(student=student, session__grade=grade_name).exclude(
            session__date__week_day=1
        ).exclude(
            session__date__in=holiday_dates
        )
        total_days = attendance_records.count()
        present_days = attendance_records.filter(status__in=['PRESENT', 'LATE']).count()
        percentage = (present_days / total_days * 100) if total_days > 0 else 0.0
        
        TimelineMark.objects.update_or_create(
            student_global_id=student.suid,
            subject=instance.exam.subject_mapping.subject.name if (instance.exam.subject_mapping and instance.exam.subject_mapping.subject) else 'Unknown',
            exam_name=instance.exam.name,
            grade=grade_name,
            defaults={
                'marks_obtained': instance.marks_obtained,
                'total_marks': instance.exam.max_marks,
                'passing_marks': instance.exam.passing_marks,
                'is_pass': instance.result_status == 'PASS',
                'is_absent': instance.is_absent,
                'attendance_percentage': percentage,
                'days_present': present_days,
                'total_days': total_days,
            }
        )
    except Exception as e:
        print(f"Error in sync_timeline_result: {e}")


@receiver(post_delete, sender=Result)
def delete_timeline_result(sender, instance, **kwargs):
    """Delete TimelineMark when Result is deleted."""
    try:
        from apps.timeline.models import TimelineMark
        student = instance.student
        grade_name = instance.exam.section.grade_config.grade_name if (instance.exam.section and instance.exam.section.grade_config) else 'Unknown'
        subject_name = instance.exam.subject_mapping.subject.name if (instance.exam.subject_mapping and instance.exam.subject_mapping.subject) else 'Unknown'
        
        TimelineMark.objects.filter(
            student_global_id=student.suid,
            subject=subject_name,
            exam_name=instance.exam.name,
            grade=grade_name
        ).delete()
    except Exception as e:
        print(f"Error in delete_timeline_result: {e}")

