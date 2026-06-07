"""
Permission Registry for School-OS

Defines all available permissions in the system organized by module.
This serves as the single source of truth for all permissions.

When adding a new feature, add its permissions here.
"""

# Permission definitions organized by module
# Format: (codename, name, description, action, resource, is_sensitive)

PERMISSION_REGISTRY = {
    # =====================
    # STUDENTS MODULE
    # =====================
    'students': {
        'label': 'Students',
        'icon': 'Users',
        'permissions': [
            ('students.view_student', 'View Students', 'View student profiles and basic information', 'view', 'student', False),
            ('students.create_student', 'Create Students', 'Add new students to the system', 'create', 'student', False),
            ('students.edit_student', 'Edit Students', 'Modify student information', 'edit', 'student', False),
            ('students.delete_student', 'Delete Students', 'Remove students from the system', 'delete', 'student', True),
            ('students.view_guardian', 'View Guardians', 'View parent/guardian information', 'view', 'guardian', False),
            ('students.manage_guardian', 'Manage Guardians', 'Add/edit guardian information', 'manage', 'guardian', False),
            ('students.export_students', 'Export Students', 'Export student data to files', 'export', 'student', False),
            ('students.import_students', 'Import Students', 'Bulk import students', 'import', 'student', False),
            ('students.view_documents', 'View Documents', 'View student documents', 'view', 'document', False),
            ('students.manage_documents', 'Manage Documents', 'Upload/delete student documents', 'manage', 'document', False),
        ]
    },
    
    # =====================
    # TEACHERS MODULE
    # =====================
    'teachers': {
        'label': 'Teachers',
        'icon': 'Briefcase',
        'permissions': [
            ('teachers.view_teacher', 'View Teachers', 'View teacher profiles', 'view', 'teacher', False),
            ('teachers.create_teacher', 'Create Teachers', 'Add new teachers', 'create', 'teacher', False),
            ('teachers.edit_teacher', 'Edit Teachers', 'Modify teacher information', 'edit', 'teacher', False),
            ('teachers.delete_teacher', 'Delete Teachers', 'Remove teachers from the system', 'delete', 'teacher', True),
            ('teachers.assign_classes', 'Assign Classes', 'Assign teachers to classes/sections', 'manage', 'assignment', False),
            ('teachers.view_assignments', 'View Assignments', 'View teacher class assignments', 'view', 'assignment', False),
        ]
    },
    
    # =====================
    # ACADEMICS MODULE
    # =====================
    'academics': {
        'label': 'Academics',
        'icon': 'BookOpen',
        'permissions': [
            ('academics.view_grades', 'View Grades', 'View grade/class information', 'view', 'grade', False),
            ('academics.manage_grades', 'Manage Grades', 'Create/edit grades and sections', 'manage', 'grade', False),
            ('academics.view_subjects', 'View Subjects', 'View subject list', 'view', 'subject', False),
            ('academics.manage_subjects', 'Manage Subjects', 'Create/edit subjects', 'manage', 'subject', False),
            ('academics.view_exams', 'View Exams', 'View exam schedules and configurations', 'view', 'exam', False),
            ('academics.create_exam', 'Create Exams', 'Create new exams', 'create', 'exam', False),
            ('academics.edit_exam', 'Edit Exams', 'Modify exam details', 'edit', 'exam', False),
            ('academics.delete_exam', 'Delete Exams', 'Remove exams', 'delete', 'exam', True),
            ('academics.enter_marks', 'Enter Marks', 'Enter student exam marks', 'edit', 'marks', False),
            ('academics.view_marks', 'View Marks', 'View student marks', 'view', 'marks', False),
            ('academics.approve_marks', 'Approve Marks', 'Approve entered marks', 'approve', 'marks', False),
            ('academics.publish_results', 'Publish Results', 'Publish exam results', 'publish', 'results', True),
            ('academics.view_report_cards', 'View Report Cards', 'View student report cards', 'view', 'report_card', False),
            ('academics.generate_report_cards', 'Generate Report Cards', 'Generate report cards', 'create', 'report_card', False),
            ('academics.manage_timetable', 'Manage Timetable', 'Create/edit class timetables', 'manage', 'timetable', False),
            ('academics.view_timetable', 'View Timetable', 'View class timetables', 'view', 'timetable', False),
        ]
    },
    
    # =====================
    # ATTENDANCE MODULE
    # =====================
    'attendance': {
        'label': 'Attendance',
        'icon': 'CalendarCheck',
        'permissions': [
            ('attendance.view_attendance', 'View Attendance', 'View attendance records', 'view', 'attendance', False),
            ('attendance.mark_attendance', 'Mark Attendance', 'Mark student attendance', 'create', 'attendance', False),
            ('attendance.edit_attendance', 'Edit Attendance', 'Modify attendance records', 'edit', 'attendance', False),
            ('attendance.approve_attendance', 'Approve Attendance', 'Approve attendance corrections', 'approve', 'attendance', False),
            ('attendance.view_reports', 'View Attendance Reports', 'View attendance analytics', 'view', 'attendance_report', False),
            ('attendance.export_attendance', 'Export Attendance', 'Export attendance data', 'export', 'attendance', False),
        ]
    },
    
    # =====================
    # FINANCE MODULE
    # =====================
    'finance': {
        'label': 'Finance',
        'icon': 'Banknote',
        'permissions': [
            ('finance.view_fees', 'View Fees', 'View fee structures and student fees', 'view', 'fee', False),
            ('finance.manage_fee_structure', 'Manage Fee Structure', 'Create/edit fee structures', 'manage', 'fee_structure', True),
            ('finance.collect_fees', 'Collect Fees', 'Record fee payments', 'create', 'payment', False),
            ('finance.view_payments', 'View Payments', 'View payment history', 'view', 'payment', False),
            ('finance.issue_refund', 'Issue Refunds', 'Process fee refunds', 'create', 'refund', True),
            ('finance.view_reports', 'View Finance Reports', 'View financial reports', 'view', 'finance_report', False),
            ('finance.manage_discounts', 'Manage Discounts', 'Create/manage fee discounts', 'manage', 'discount', False),
            ('finance.export_finance', 'Export Finance Data', 'Export financial records', 'export', 'finance', False),
            ('finance.send_reminders', 'Send Fee Reminders', 'Send payment reminders to parents', 'manage', 'reminder', False),
        ]
    },
    
    # =====================
    # HEALTH MODULE
    # =====================
    'health': {
        'label': 'Health',
        'icon': 'Heart',
        'permissions': [
            ('health.view_records', 'View Health Records', 'View student health records', 'view', 'health_record', False),
            ('health.create_record', 'Create Health Records', 'Add health check-up records', 'create', 'health_record', False),
            ('health.edit_record', 'Edit Health Records', 'Modify health records', 'edit', 'health_record', False),
            ('health.view_medical_history', 'View Medical History', 'View detailed medical history', 'view', 'medical_history', True),
            ('health.manage_incidents', 'Manage Health Incidents', 'Record health incidents', 'manage', 'incident', False),
        ]
    },
    
    # =====================
    # DISCIPLINE MODULE
    # =====================
    'discipline': {
        'label': 'Discipline',
        'icon': 'AlertTriangle',
        'permissions': [
            ('discipline.view_records', 'View Discipline Records', 'View discipline records', 'view', 'discipline_record', False),
            ('discipline.create_record', 'Create Discipline Records', 'Record disciplinary incidents', 'create', 'discipline_record', False),
            ('discipline.edit_record', 'Edit Discipline Records', 'Modify discipline records', 'edit', 'discipline_record', False),
            ('discipline.delete_record', 'Delete Discipline Records', 'Remove discipline records', 'delete', 'discipline_record', True),
            ('discipline.manage_karma', 'Manage Karma Points', 'Add/deduct karma points', 'manage', 'karma', False),
            ('discipline.view_karma', 'View Karma Points', 'View student karma', 'view', 'karma', False),
            ('discipline.issue_suspension', 'Issue Suspension', 'Suspend students', 'create', 'suspension', True),
        ]
    },
    
    # =====================
    # GATE PASS MODULE
    # =====================
    'gatepass': {
        'label': 'Gate Pass',
        'icon': 'Shield',
        'permissions': [
            ('gatepass.view_passes', 'View Gate Passes', 'View gate pass records', 'view', 'gatepass', False),
            ('gatepass.create_pass', 'Create Gate Pass', 'Issue new gate passes', 'create', 'gatepass', False),
            ('gatepass.approve_pass', 'Approve Gate Pass', 'Approve gate pass requests', 'approve', 'gatepass', False),
            ('gatepass.checkout_student', 'Checkout Student', 'Mark student exit', 'edit', 'checkout', False),
            ('gatepass.checkin_student', 'Check-in Student', 'Mark student return', 'edit', 'checkin', False),
        ]
    },
    
    # =====================
    # ACHIEVEMENTS MODULE
    # =====================
    'achievements': {
        'label': 'Achievements',
        'icon': 'Trophy',
        'permissions': [
            ('achievements.view_achievements', 'View Achievements', 'View student achievements', 'view', 'achievement', False),
            ('achievements.create_achievement', 'Create Achievement', 'Record new achievements', 'create', 'achievement', False),
            ('achievements.edit_achievement', 'Edit Achievement', 'Modify achievement records', 'edit', 'achievement', False),
            ('achievements.delete_achievement', 'Delete Achievement', 'Remove achievements', 'delete', 'achievement', False),
            ('achievements.approve_achievement', 'Approve Achievement', 'Approve achievement submissions', 'approve', 'achievement', False),
        ]
    },
    
    # =====================
    # TRANSFERS MODULE
    # =====================
    'transfers': {
        'label': 'Transfers',
        'icon': 'ArrowRightLeft',
        'permissions': [
            ('transfers.view_transfers', 'View Transfers', 'View transfer requests', 'view', 'transfer', False),
            ('transfers.initiate_transfer', 'Initiate Transfer', 'Start transfer process', 'create', 'transfer', False),
            ('transfers.approve_transfer', 'Approve Transfer', 'Approve/reject transfers', 'approve', 'transfer', True),
            ('transfers.issue_tc', 'Issue TC', 'Issue transfer certificates', 'create', 'tc', True),
        ]
    },
    
    # =====================
    # ENROLLMENTS MODULE
    # =====================
    'enrollments': {
        'label': 'Enrollments',
        'icon': 'UserCheck',
        'permissions': [
            ('enrollments.view_enrollments', 'View Enrollments', 'View enrollment records', 'view', 'enrollment', False),
            ('enrollments.create_enrollment', 'Create Enrollment', 'Enroll students', 'create', 'enrollment', False),
            ('enrollments.edit_enrollment', 'Edit Enrollment', 'Modify enrollment details', 'edit', 'enrollment', False),
            ('enrollments.approve_enrollment', 'Approve Enrollment', 'Approve enrollment requests', 'approve', 'enrollment', False),
            ('enrollments.promote_students', 'Promote Students', 'Promote students to next class', 'manage', 'promotion', True),
            ('enrollments.manage_sections', 'Manage Section Assignment', 'Assign students to sections', 'manage', 'section', False),
        ]
    },
    
    # =====================
    # REPORTS MODULE
    # =====================
    'reports': {
        'label': 'Reports',
        'icon': 'FileText',
        'permissions': [
            ('reports.view_analytics', 'View Analytics', 'View school analytics dashboard', 'view', 'analytics', False),
            ('reports.generate_reports', 'Generate Reports', 'Generate various reports', 'create', 'report', False),
            ('reports.export_reports', 'Export Reports', 'Export reports to files', 'export', 'report', False),
            ('reports.view_audit_logs', 'View Audit Logs', 'View system audit logs', 'view', 'audit_log', True),
        ]
    },
    
    # =====================
    # SETTINGS MODULE
    # =====================
    'settings': {
        'label': 'Settings',
        'icon': 'Settings',
        'permissions': [
            ('settings.view_settings', 'View Settings', 'View school settings', 'view', 'settings', False),
            ('settings.manage_settings', 'Manage Settings', 'Modify school settings', 'manage', 'settings', True),
            ('settings.manage_academic_config', 'Manage Academic Config', 'Configure academic year, terms', 'manage', 'academic_config', True),
            ('settings.manage_grading', 'Manage Grading System', 'Configure grading scales', 'manage', 'grading', True),
            ('settings.manage_calendar', 'Manage Calendar', 'Manage holidays and events', 'manage', 'calendar', False),
        ]
    },
    
    # =====================
    # USER MANAGEMENT MODULE
    # =====================
    'users': {
        'label': 'User Management',
        'icon': 'Users',
        'permissions': [
            ('users.view_users', 'View Users', 'View user accounts', 'view', 'user', False),
            ('users.create_user', 'Create Users', 'Create new user accounts', 'create', 'user', True),
            ('users.edit_user', 'Edit Users', 'Modify user accounts', 'edit', 'user', True),
            ('users.delete_user', 'Delete Users', 'Deactivate/delete users', 'delete', 'user', True),
            ('users.reset_password', 'Reset Passwords', 'Reset user passwords', 'manage', 'password', True),
            ('users.manage_permissions', 'Manage User Permissions', 'Assign roles to users', 'manage', 'permission', True),
        ]
    },
    
    # =====================
    # ROLE MANAGEMENT MODULE
    # =====================
    'roles': {
        'label': 'Role Management',
        'icon': 'Shield',
        'permissions': [
            ('roles.view_roles', 'View Roles', 'View available roles', 'view', 'role', False),
            ('roles.create_role', 'Create Roles', 'Create new custom roles', 'create', 'role', True),
            ('roles.edit_role', 'Edit Roles', 'Modify role permissions', 'edit', 'role', True),
            ('roles.delete_role', 'Delete Roles', 'Delete custom roles', 'delete', 'role', True),
            ('roles.assign_role', 'Assign Roles', 'Assign roles to users', 'manage', 'assignment', True),
        ]
    },
}


# Default role templates with pre-assigned permissions
DEFAULT_ROLE_TEMPLATES = {
    'PRINCIPAL': {
        'name': 'Principal',
        'description': 'Head of the school with full administrative access',
        'hierarchy_level': 90,
        'permissions': [
            # Full access to most modules
            'students.*', 'teachers.*', 'academics.*', 'attendance.*',
            'finance.*', 'health.*', 'discipline.*', 'gatepass.*',
            'achievements.*', 'transfers.*', 'enrollments.*', 'reports.*',
            'settings.*', 'users.*', 'roles.*'
        ]
    },
    'VICE_PRINCIPAL': {
        'name': 'Vice Principal',
        'description': 'Assists principal with administrative duties',
        'hierarchy_level': 80,
        'permissions': [
            'students.*', 'teachers.view_*', 'academics.*', 'attendance.*',
            'discipline.*', 'gatepass.*', 'achievements.*', 'enrollments.*',
            'reports.view_*', 'reports.generate_reports'
        ]
    },
    'HEAD_OF_DEPARTMENT': {
        'name': 'Head of Department',
        'description': 'Manages a specific department or subject area',
        'hierarchy_level': 70,
        'permissions': [
            'students.view_student', 'teachers.view_*', 
            'academics.view_*', 'academics.enter_marks', 'academics.approve_marks',
            'attendance.view_*', 'attendance.mark_attendance',
            'discipline.view_*', 'discipline.create_record',
            'reports.view_analytics'
        ]
    },
    'CLASS_TEACHER': {
        'name': 'Class Teacher',
        'description': 'Responsible for a specific class/section',
        'hierarchy_level': 50,
        'permissions': [
            'students.view_student', 'students.view_guardian',
            'academics.view_*', 'academics.enter_marks', 'academics.view_report_cards',
            'attendance.view_attendance', 'attendance.mark_attendance',
            'discipline.view_records', 'discipline.create_record', 'discipline.manage_karma',
            'gatepass.view_passes', 'gatepass.create_pass',
            'achievements.view_achievements', 'achievements.create_achievement',
            'health.view_records'
        ]
    },
    'SUBJECT_TEACHER': {
        'name': 'Subject Teacher',
        'description': 'Teaches specific subjects',
        'hierarchy_level': 40,
        'permissions': [
            'students.view_student',
            'academics.view_exams', 'academics.enter_marks', 'academics.view_marks',
            'attendance.view_attendance', 'attendance.mark_attendance',
            'discipline.view_records', 'discipline.create_record'
        ]
    },
    'ACCOUNTANT': {
        'name': 'Accountant',
        'description': 'Manages school finances',
        'hierarchy_level': 60,
        'permissions': [
            'students.view_student', 'students.view_guardian',
            'finance.*',
            'reports.view_analytics', 'reports.generate_reports', 'reports.export_reports'
        ]
    },
    'RECEPTIONIST': {
        'name': 'Receptionist',
        'description': 'Front desk operations',
        'hierarchy_level': 30,
        'permissions': [
            'students.view_student', 'students.view_guardian',
            'teachers.view_teacher',
            'gatepass.*',
            'enrollments.view_enrollments', 'enrollments.create_enrollment'
        ]
    },
    'COUNSELOR': {
        'name': 'Counselor',
        'description': 'Student counseling and welfare',
        'hierarchy_level': 50,
        'permissions': [
            'students.view_student', 'students.view_guardian', 'students.view_documents',
            'health.view_records', 'health.view_medical_history',
            'discipline.view_records',
            'achievements.view_achievements'
        ]
    },
}


def get_all_permission_codenames():
    """Get a flat list of all permission codenames."""
    codenames = []
    for module, data in PERMISSION_REGISTRY.items():
        for perm in data['permissions']:
            codenames.append(perm[0])
    return codenames


def get_permissions_for_module(module):
    """Get all permissions for a specific module."""
    if module in PERMISSION_REGISTRY:
        return PERMISSION_REGISTRY[module]['permissions']
    return []


def expand_wildcard_permissions(patterns):
    """
    Expand wildcard patterns like 'students.*' to actual permission codenames.
    
    Examples:
    - 'students.*' -> all students permissions
    - 'students.view_*' -> all view permissions in students
    """
    expanded = []
    all_perms = get_all_permission_codenames()
    
    for pattern in patterns:
        if '*' in pattern:
            # It's a wildcard pattern
            module_part = pattern.split('.')[0]
            action_part = pattern.split('.')[1] if '.' in pattern else '*'
            
            for codename in all_perms:
                perm_module = codename.split('.')[0]
                perm_action = codename.split('.')[1] if '.' in codename else ''
                
                # Match module
                if module_part != '*' and perm_module != module_part:
                    continue
                
                # Match action pattern
                if action_part == '*':
                    expanded.append(codename)
                elif action_part.endswith('*'):
                    prefix = action_part[:-1]
                    if perm_action.startswith(prefix):
                        expanded.append(codename)
                elif perm_action == action_part:
                    expanded.append(codename)
        else:
            # Direct permission codename
            if pattern in all_perms:
                expanded.append(pattern)
    
    return list(set(expanded))
