from .services import school_has_feature

def can(user, action_code, feature_code=None):
    """
    The Universal Permission Checker.
    """
    # 1. Safety Net
    if not user or not user.is_authenticated or not user.is_active:
        return False

    # 2. God Mode (Admin)
    if user.is_superuser:
        return True
    
    # 2b. Platform Admin has full access
    user_type = getattr(user, 'user_type', None)
    if user_type == 'PLATFORM_ADMIN':
        return True
    
    # 2c. School Admin has full access to their school's data
    if user_type in ['SCHOOL_ADMIN', 'ADMIN']:
        return True

    # 3. School Feature Gate
    # If the feature is turned OFF for the school, nobody (except Admin) can use it.
    if feature_code:
        school_id = getattr(user, 'school_id', None)
        if school_id and not school_has_feature(school_id, feature_code):
            return False

    # 4. Role-Based Access for Teachers and Students
    if user_type == 'TEACHER':
        allowed_actions = [
            # Attendance
            'VIEW_ATTENDANCE', 'MARK_ATTENDANCE',
            # Marks
            'VIEW_MARKS', 'ENTER_MARKS',
            # General
            'VIEW_TIMETABLE',
            'VIEW_STUDENT_PROFILE', 'VIEW_STUDENT_DIRECTORY',
            # Discipline
            'ADD_DISCIPLINE',
            # Gate Pass
            'ISSUE_GATE_PASS', 
        ]
        return action_code in allowed_actions

    if user_type == 'STUDENT':
        allowed_actions = [
            'VIEW_ATTENDANCE', 'VIEW_MARKS', 'VIEW_TIMETABLE', 'VIEW_STUDENT_PROFILE'
        ]
        return action_code in allowed_actions

    if user_type == 'PARENT':
        if feature_code == 'PARENT_PORTAL': 
            return True
        allowed_actions = ['VIEW_CHILD_ATTENDANCE', 'VIEW_CHILD_MARKS']
        return action_code in allowed_actions

    return False