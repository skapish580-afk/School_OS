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
    # DASHBOARD MODULE
    # =====================
    'dashboard': {
        'label': 'Dashboard',
        'icon': 'LayoutDashboard',
        'permissions': [
            # Calendar
            ('dashboard.access_calendar', 'Calendar Access', 'Gives access to the calendar section in the dashboard module', 'view', 'calendar', False),
            
            # Notes
            ('dashboard.view_notes', 'Notes: View-only', 'Gives only the view-only access to notes section of dashboard module', 'view', 'notes', False),
            ('dashboard.manage_notes', 'Notes: Add/delete', 'Gives the permissions to add and delete notes', 'manage', 'notes', False),
            
            # Notifications
            ('dashboard.view_notifications', 'Notifications: View-Only', 'Gives the view-only access to notification section', 'view', 'notifications', False),
            ('dashboard.notify_teachers', 'Notifications: Notify Teachers', 'Gives access to notify teachers only', 'create', 'notifications', False),
            ('dashboard.notify_students', 'Notifications: Notify Students', 'Gives access to notify students only', 'create', 'notifications', False),
            ('dashboard.notify_everyone', 'Notifications: Notify Everyone', 'Gives access to notify both students and teachers', 'create', 'notifications', False),
        ]
    },
    
    # =====================
    # CALENDAR MODULE
    # =====================
    'calendar': {
        'label': 'Calendar',
        'icon': 'Calendar',
        'permissions': [
            # Holiday
            ('calendar.manage_holiday', 'Create/Delete Holiday', 'Gives permission to create and delete the holiday on calendar', 'manage', 'holiday', False),
            # Event
            ('calendar.manage_event', 'Create/Delete Event', 'Gives permission to create and delete event on calendar', 'manage', 'event', False),
        ]
    },
    # =====================
    # STUDENTS MODULE
    # =====================
    'students': {
        'label': 'Students',
        'icon': 'Users',
        'permissions': [
            # Student Profile Details / Actions
            ('students.add_student', 'Add Student', 'Gives permission to add a student', 'create', 'student', False),
            ('students.edit_profile', 'Edit Student Profile Details', 'Gives permission to edit student profile details', 'edit', 'profile', False),
            ('students.hide_student', 'Hide Student Details', 'Gives permission to hide student profile details', 'delete', 'student', True),
            ('students.view_student_only', 'View Student Only', 'Gives permission to only view all student details (except health records, student profile, student journey)', 'view', 'student', False),
            ('students.record_achievements', 'Record Achievements', 'Gives permission to record achievements', 'create', 'achievements', False),
            ('students.manage_behavior', 'Award Karma and Report Incident', 'Gives permission to award karma and report incident', 'manage', 'behavior', False),
            ('students.issue_pass', 'Issue Pass', 'Gives permission to issue gate pass', 'create', 'gatepass', False),
            ('students.view_health', 'View Health Records', 'Gives permission to view health records', 'view', 'health', True),
            ('students.view_profile', 'View Profile', 'Gives permission to view student profile', 'view', 'profile', False),
            ('students.view_journey', 'View Journey', 'Gives permission to view student journey', 'view', 'journey', False),
        ]
    },
    # =====================
    # ENROLLMENTS MODULE
    # =====================
    'enrollments': {
        'label': 'Enrollments',
        'icon': 'UserCheck',
        'permissions': [
            ('enrollments.view_enrollment', 'View-Only', 'Gives permission to only view the enrollments module section', 'view', 'enrollment', False),
            ('enrollments.change_enrollment_status', 'Change Status', 'Gives permission to change student enrollment status', 'edit', 'enrollment', False),
        ]
    },
    # =====================
    # TEACHERS MODULE
    # =====================
    'teachers': {
        'label': 'Teachers',
        'icon': 'Briefcase',
        'permissions': [
            ('teachers.view_teaching', 'View Only Teaching Staff', 'Gives permission to view teaching staff profiles only', 'view', 'teacher', False),
            ('teachers.view_non_teaching', 'View Only Non-Teaching Staff', 'Gives permission to view non-teaching staff profiles only', 'view', 'teacher', False),
            ('teachers.manage_teaching', 'Add/Delete Teaching Staff', 'Gives permission to add and delete teaching staff', 'manage', 'teacher', False),
            ('teachers.manage_non_teaching', 'Add/Delete Non-Teaching Staff', 'Gives permission to add and delete non-teaching staff', 'manage', 'teacher', False),
            ('teachers.assign_role_teaching', 'Assign Role( Teaching Staff)', 'Gives permission to assign role to teaching staff', 'manage', 'teacher', False),
            ('teachers.assign_role_non_teaching', 'Assign Role( Non-Teaching Staff)', 'Gives permission to assign role to non-teaching staff', 'manage', 'teacher', False),
            ('teachers.delete_assigned_role', 'Delete assigned role', 'Gives permission to delete the role assigned to a teacher in teachers module', 'delete', 'teacher', False),
        ]
    },
    # =====================
    # ACADEMICS MODULE
    # =====================
    'academics': {
        'label': 'Academics',
        'icon': 'GraduationCap',
        'permissions': [
            # Classes & Sections
            ('academics.view_class', 'View Class', 'Gives permission to only view the classes and sections along with the access to only view the details of class & section', 'view', 'classes_sections', False),
            ('academics.manage_class', 'Add/Delete Class', 'Gives permission to add a class and to delete the class', 'manage', 'classes_sections', False),
            ('academics.edit_class', 'Edit Class', 'Gives permission to edit class', 'edit', 'classes_sections', False),
            # Subjects Directory
            ('academics.view_subject', 'View-Only', 'Gives permissions to only view the Subject Directory of the Subjects section', 'view', 'subjects_directory', False),
            ('academics.manage_subject', 'Add/Delete Subject', 'Gives permissions to only add/delete the subject', 'manage', 'subjects_directory', False),
            ('academics.edit_subject', 'Edit Subject', 'Gives permissions to edit the added subject', 'edit', 'subjects_directory', False),
            # Subject Allocation
            ('academics.view_subject_allocation', 'View-Only', 'Gives the permissions to only view which class has what all subjects allocated to it', 'view', 'subject_allocation', False),
            ('academics.manage_subject_allocation', 'Allocate Core/Elective Subjects', 'Gives the permissions to allocate core and elective subjects to different classes and sections', 'manage', 'subject_allocation', False),
            # Timetable
            ('academics.add_timetable', 'Add Timetable', 'Gives permission to add and do all actions on the timetable created by him', 'create', 'timetable', False),
            # Syllabus
            ('academics.view_syllabus', 'View Only', 'Gives access to only view the syllabus section along with viewing only of chapters of subjects to see the progress', 'view', 'syllabus', False),
            ('academics.add_syllabus', 'Add Syllabus', 'Gives permission to add/create a new syllabus for a subject', 'create', 'syllabus', False),
            ('academics.add_chapter', 'Add Chapter', 'Gives permission to add a new chapter to the syllabus', 'create', 'syllabus', False),
            ('academics.edit_chapter', 'Edit Chapters', 'Gives permission to edit chapter status or delete the chapter', 'edit', 'syllabus', False),
            # Exams
            ('academics.view_exam', 'View-Only', 'Gives permission to only view the exam section', 'view', 'exams', False),
            ('academics.add_exam', 'Create Exams', 'Gives permission to create exams', 'create', 'exams', False),
            # Marks Entry
            ('academics.view_marks_entry', 'Enter & Manage Marks', 'Gives permission to enter, save, and lock student marks', 'manage', 'marks_entry', False),
            # Results
            ('academics.view_results', 'View-Only', 'Gives permission to only view the results section', 'view', 'results', False),
            ('academics.generate_report_card', 'Generate Report Cards', 'Gives permission to generate student report cards', 'manage', 'results', False),
            ('academics.download_report_card', 'Download Report Cards', 'Gives permission to download report cards', 'manage', 'results', False),
        ]
    },
    # =====================
    # ATTENDANCE MODULE
    # =====================
    'attendance': {
        'label': 'Attendance',
        'icon': 'CalendarDays',
        'permissions': [
            ('attendance.view_attendance', 'View-Only', 'Gives permissions to only view the attendance of the students', 'view', 'attendance', False),
            ('attendance.change_attendance', 'Edit', 'Gives permissions to edit, save, and lock the attendance register', 'edit', 'attendance', False),
        ]
    },
    # =====================
    # FINANCE MODULE
    # =====================
    'finance': {
        'label': 'Finance',
        'icon': 'DollarSign',
        'permissions': [
            ('finance.view_overview', 'View-only', 'Gives permission to only view the overview section', 'view', 'overview', False),
            ('finance.generate_invoice', 'Generate Invoice', "Gives permission to generate and delete invoices in the finance module", 'manage', 'overview', False),

            ('finance.manage_categories', 'Fee Categories', "Gives permission to access the entire 'Fee Categories' feature of the finance module's overview section", 'manage', 'overview', False),
            ('finance.bulk_assign', 'Bulk Assign Fees', "Gives permission to access the entire 'Bulk Assign Fees' feature of the finance module's overview section", 'manage', 'overview', False),
            ('finance.allocate_plan', 'Allocate Payment Plan', "Gives permission to access the entire 'Allocate Payment Plan' feature of the finance module's overview section", 'manage', 'overview', False),
            ('finance.apply_late_fees', 'Apply Late Fees', "Gives permission to access the entire 'Apply Late Fees' feature of the finance module's overview section", 'manage', 'overview', False),
            
            # Invoices
            ('finance.view_invoice', 'View-only', 'Gives permission to only view the invoices section', 'view', 'invoice', False),
            ('finance.collect_fee', 'Collect Payment', 'Gives permission to collect payments on invoices', 'edit', 'invoice', False),
            
            # Fee Packages (Structures)
            ('finance.view_fee_structure', 'View-only', 'Gives permission to only view the fee packages section', 'view', 'fee_structure', False),
            ('finance.edit_fee_structure', 'Manage', 'Gives permission to create, edit, or delete fee packages', 'edit', 'fee_structure', False),
            
            # Payment Plans (Schedules)
            ('finance.view_fee_schedule', 'View-only', 'Gives permission to only view the payment plans section', 'view', 'fee_schedule', False),
            ('finance.edit_fee_schedule', 'Manage', 'Gives permission to create, edit, or delete payment plans', 'edit', 'fee_schedule', False),
            
            # Fee Assignments
            ('finance.view_fee_assignment', 'View-only', 'Gives permission to only view the fee assignments section', 'view', 'fee_assignment', False),
            ('finance.edit_fee_assignment', 'Manage', 'Gives permission to assign fee structures to students', 'edit', 'fee_assignment', False),
            
            # Student Ledgers
            ('finance.view_ledger', 'View-only', 'Gives permission to only view the student ledgers section', 'view', 'ledger', False),
            ('finance.edit_ledger', 'Manage', 'Gives permission to perform manual ledger entries', 'edit', 'ledger', False),
            
            # Salary
            ('finance.view_salary', 'View-only', 'Gives permission to only view the salary section', 'view', 'salary', False),
            ('finance.edit_salary', 'Manage', 'Gives permission to manage salaries and deductions', 'edit', 'salary', False),
        ]
    },
    # =====================
    # HEALTH MODULE
    # =====================
    'health': {
        'label': 'Health',
        'icon': 'Heart',
        'permissions': [
            ('health.view_health', 'View-only', 'Gives permission to view health records and clinic visits', 'view', 'health', False),
            ('health.add_health', 'Add', 'Gives permission to add/log health records and clinic visits', 'edit', 'health', False),
        ]
    },
    # =====================
    # GATE PASS MODULE
    # =====================
    'gatepass': {
        'label': 'Gate Pass',
        'icon': 'Shield',
        'permissions': [
            ('gatepass.view_student_gatepass', 'View-Only', 'Gives the permissions to view the student gate pass section', 'view', 'student_gate_pass', False),
            ('gatepass.edit_student_gatepass', 'Edit', 'Gives the permissions to edit student gate pass', 'edit', 'student_gate_pass', False),
            ('gatepass.view_visitor_pass', 'View-Only', 'Gives permission to view the visitor pass section', 'view', 'visitor_pass', False),
            ('gatepass.edit_visitor_pass', 'Edit', 'Gives permission to edit visitor pass section', 'edit', 'visitor_pass', False),
        ]
    },
    # =====================
    # TRANSPORT MODULE
    # =====================
    'transport': {
        'label': 'Transport',
        'icon': 'Bus',
        'permissions': [
            ('transport.view_transport', 'View-Only', 'Gives permission to only view the transport module', 'view', 'transport', False),
            ('transport.edit_bus', 'Add/Edit Bus', 'Gives permission to create, edit, or delete buses', 'edit', 'bus', False),
            ('transport.view_route', 'View Route', 'Gives permission to view bus routes', 'view', 'route', False),
            ('transport.assign_route', 'Assign Route', 'Gives permission to assign routes to buses', 'edit', 'route', False),
            ('transport.mark_attendance', 'Mark Attendance', 'Gives permission to mark attendance of students in a bus', 'edit', 'mark_attendance', False),
        ]
    },
    # =====================
    # LIBRARY MODULE
    # =====================
    'library': {
        'label': 'Library',
        'icon': 'BookOpen',
        'permissions': [
            ('library.view_library', 'View-Only', 'Gives permission to only view the home page of library module (including library policy but excluding the visibility of any of the logs)', 'view', 'general', False),
            ('library.edit_books', 'Add/Edit Books', 'Gives permission to add and edit books in the library module', 'edit', 'general', False),
            ('library.update_policy', 'Update Library Rules/Policy', 'Gives permission to update library rules and policy', 'edit', 'general', False),
            
            ('library.view_circulation_log', 'View-Only', 'Gives permission to only view the circulation log', 'view', 'circulation_log', False),
            ('library.edit_circulation_log', 'Add/Edit', 'Gives permission to add and edit in the circulation log', 'edit', 'circulation_log', False),

            ('library.view_stock_log', 'View-Only', 'Gives permission to only view the stock register log', 'view', 'stock_register_log', False),
            ('library.edit_stock_log', 'Add/Edit', 'Gives permission to add and edit in the stock register log', 'edit', 'stock_register_log', False),

            ('library.view_visitor_log', 'View-Only', 'Gives permission to only view the visitor log', 'view', 'visitor_log', False),
            ('library.edit_visitor_log', 'Add/Edit', 'Gives permission to add and edit in the visitor log', 'edit', 'visitor_log', False),

            ('library.view_fines_log', 'View-Only', 'Gives permission to only view the fine & fees log', 'view', 'fine_fees_log', False),
            ('library.edit_fines_log', 'Add/Edit', 'Gives permission to add and edit in the fine & fees log', 'edit', 'fine_fees_log', False),
        ]
    },
    # =====================
    # ASSETS MODULE
    # =====================
    'assets': {
        'label': 'Assets',
        'icon': 'Box',
        'permissions': [
            ('assets.view_assets', 'View-Only', 'Gives permission to view the asset module only', 'view', 'general', False),
            ('assets.edit_assets', 'Add/Sell Asset', 'Gives permission to add or sell assets in the assets module', 'edit', 'general', False),
            ('assets.schedule_maintenance', 'Schedule Maintenance/Audit', 'Gives permission to schedule maintenance or audit for assets', 'edit', 'general', False),
        ]
    },
    # =====================
    # DATA UPLOADS MODULE
    # =====================
    'data_uploads': {
        'label': 'Data Uploads',
        'icon': 'UploadCloud',
        'permissions': [
            ('data_uploads.upload_data', 'Upload Data', 'Gives full access to the Data Uploads module', 'edit', 'general', False),
        ]
    },
    # =====================
    # STUDENT ARCHIVE MODULE
    # =====================
    'student_archive': {
        'label': 'Student Archive',
        'icon': 'Archive',
        'permissions': [
            ('student_archive.view_student_archive', 'View-Only', 'Gives permission to only view the entire profile of the student in student archive module', 'view', 'general', False),
        ]
    },
    # =====================
    # ROLE SETTINGS MODULE
    # =====================
    'roles': {
        'label': 'Role Settings',
        'icon': 'Shield',
        'permissions': [
            ('roles.view_roles', 'View Roles', 'Gives permission to view all roles and their permissions', 'view', 'general', False),
            ('roles.create_role', 'Create Role (Unrestricted)', 'Gives permission to create new roles with any permissions and hierarchy level up to 100', 'create', 'general', True),
            ('roles.edit_role', 'Edit Role', 'Gives permission to edit existing roles (name, description, hierarchy level, permissions)', 'edit', 'general', True),
            ('roles.delete_role', 'Delete Role', 'Gives permission to delete roles that are not assigned to any users', 'delete', 'general', True),
            ('roles.assign_role', 'Assign/Remove Role', 'Gives permission to assign or remove roles from staff members', 'manage', 'general', True),
            ('roles.allow_role_creation', 'Allow Role Creation (Restricted)', 'Allows this role to create new sub-roles, but only with permissions and hierarchy level that this role itself has. This is a delegated, sandboxed form of role creation.', 'create', 'general', True),
        ]
    },
    # =====================
    # ASSIGNMENT SETTINGS MODULE
    # =====================
    'assignment_settings': {
        'label': 'Assignment Settings',
        'icon': 'UserCheck',
        'permissions': [
            ('assignment_settings.dept_administration', 'Department: Administration', 'Permission to assign roles to staff in Administration department', 'manage', 'dept_standard', False),
            ('assignment_settings.dept_accounts_finance', 'Department: Accounts & Finance', 'Permission to assign roles to staff in Accounts & Finance department', 'manage', 'dept_standard', False),
            ('assignment_settings.dept_library', 'Department: Library', 'Permission to assign roles to staff in Library department', 'manage', 'dept_standard', False),
            ('assignment_settings.dept_laboratory_technical', 'Department: Laboratory & Technical Support', 'Permission to assign roles to staff in Laboratory & Technical Support department', 'manage', 'dept_standard', False),
            ('assignment_settings.dept_transport_logistics', 'Department: Transport & Logistics', 'Permission to assign roles to staff in Transport & Logistics department', 'manage', 'dept_standard', False),
            ('assignment_settings.dept_medical_health', 'Department: Medical & Health (Infirmary)', 'Permission to assign roles to staff in Medical & Health department', 'manage', 'dept_standard', False),
            ('assignment_settings.dept_security_maintenance', 'Department: Security & Maintenance', 'Permission to assign roles to staff in Security & Maintenance department', 'manage', 'dept_standard', False),
            ('assignment_settings.dept_sports_physical_education', 'Department: Sports & Physical Education', 'Permission to assign roles to staff in Sports & Physical Education department', 'manage', 'dept_standard', False),
            ('assignment_settings.dept_it_systems_support', 'Department: IT & Systems Support', 'Permission to assign roles to staff in IT & Systems Support department', 'manage', 'dept_standard', False),
            ('assignment_settings.dept_hostel_campus_facilities', 'Department: Hostel & Campus Facilities', 'Permission to assign roles to staff in Hostel & Campus Facilities department', 'manage', 'dept_standard', False),
            ('assignment_settings.dept_student_affairs_welfare', 'Department: Student Affairs & Welfare', 'Permission to assign roles to staff in Student Affairs & Welfare department', 'manage', 'dept_standard', False),
            ('assignment_settings.dept_admission_counseling', 'Department: Admission & Counseling', 'Permission to assign roles to staff in Admission & Counseling department', 'manage', 'dept_standard', False),
            ('assignment_settings.dept_food_services_canteen', 'Department: Food Services & Canteen', 'Permission to assign roles to staff in Food Services & Canteen department', 'manage', 'dept_standard', False),
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
            'dashboard.*',
            'calendar.*',
            'students.*',
            'teachers.*',
            'academics.*',
            'enrollments.*',
            'attendance.*',
            'finance.*',
            'health.*',
            'gatepass.*',
            'transport.*',
            'library.*',
            'assets.*',
            'data_uploads.*',
            'student_archive.*'
        ]
    },
    'VICE_PRINCIPAL': {
        'name': 'Vice Principal',
        'description': 'Assists principal with administrative duties',
        'hierarchy_level': 80,
        'permissions': [
            'dashboard.access_calendar',
            'dashboard.view_notes',
            'dashboard.view_notifications',
            'calendar.*',
            'students.*',
            'teachers.*',
            'academics.*',
            'enrollments.*',
            'attendance.*',
            'finance.*',
            'health.*',
            'gatepass.*',
            'transport.*',
            'library.*',
            'assets.*',
            'data_uploads.*',
            'student_archive.*'
        ]
    },
    'HEAD_OF_DEPARTMENT': {
        'name': 'Head of Department',
        'description': 'Manages a specific department or subject area',
        'hierarchy_level': 70,
        'permissions': [
            'dashboard.access_calendar',
            'dashboard.view_notes',
            'dashboard.view_notifications',
        ]
    },
    'CLASS_TEACHER': {
        'name': 'Class Teacher',
        'description': 'Responsible for a specific class/section',
        'hierarchy_level': 50,
        'permissions': [
            'dashboard.access_calendar',
            'dashboard.view_notes',
            'dashboard.view_notifications',
        ]
    },
    'SUBJECT_TEACHER': {
        'name': 'Subject Teacher',
        'description': 'Teaches specific subjects',
        'hierarchy_level': 40,
        'permissions': [
            'dashboard.access_calendar',
            'dashboard.view_notes',
        ]
    },
    'ACCOUNTANT': {
        'name': 'Accountant',
        'description': 'Manages school finances',
        'hierarchy_level': 60,
        'permissions': [
            'dashboard.access_calendar',
            'dashboard.view_notes',
        ]
    },
    'RECEPTIONIST': {
        'name': 'Receptionist',
        'description': 'Front desk operations',
        'hierarchy_level': 30,
        'permissions': [
            'dashboard.access_calendar',
            'dashboard.view_notes',
            'dashboard.view_notifications',
        ]
    },
    'COUNSELOR': {
        'name': 'Counselor',
        'description': 'Student counseling and welfare',
        'hierarchy_level': 50,
        'permissions': [
            'dashboard.access_calendar',
            'dashboard.view_notes',
        ]
    },
    'LIBRARIAN': {
        'name': 'Librarian',
        'description': 'Responsible for managing the library and books',
        'hierarchy_level': 50,
        'permissions': [
            'dashboard.access_calendar',
            'dashboard.view_notes',
            'library.*'
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
