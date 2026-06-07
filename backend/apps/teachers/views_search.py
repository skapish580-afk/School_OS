"""
Smart fuzzy search for students and teachers
Handles typos, spelling mistakes, and keyboard mismatches
"""
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.db.models import Q, Value, CharField
from django.db.models.functions import Concat
from apps.students.models import Student
from apps.teachers.models import Teacher
from apps.enrollments.models import StudentEnrollment
import re


def calculate_similarity(query, text):
    """
    Calculate similarity score between query and text
    Returns score from 0-100 (100 = exact match)
    Uses multiple strategies for maximum typo tolerance
    """
    if not query or not text:
        return 0
    
    query = query.lower().strip()
    text = text.lower().strip()
    
    # Exact match
    if query == text:
        return 100
    
    # Starts with query
    if text.startswith(query):
        return 95
    
    # Contains query as substring
    if query in text:
        return 85
    
    # Word boundary match
    words = text.split()
    for word in words:
        if word == query:
            return 90
        if word.startswith(query):
            return 80
        if query in word:
            return 75
        # Check if word starts with query (with 1 char difference)
        if len(query) >= 3 and len(word) >= 3:
            if word[:len(query)-1] == query[:len(query)-1]:
                return 72
    
    # Levenshtein distance (edit distance)
    if len(query) >= 3:
        distance = levenshtein_distance(query, text)
        max_len = max(len(query), len(text))
        
        # Allow up to 2 edits for strings of length 4+
        if distance <= 2 and len(query) >= 4:
            similarity = ((max_len - distance) / max_len) * 100
            return max(60, min(similarity, 78))
        
        # For shorter strings, allow 1 edit
        if distance == 1:
            similarity = ((max_len - distance) / max_len) * 100
            return max(55, min(similarity, 75))
    
    # Character overlap percentage
    query_chars = set(query)
    text_chars = set(text)
    overlap = len(query_chars & text_chars)
    
    if overlap >= len(query_chars) * 0.75:  # 75% of query chars present
        return 55
    
    # Subsequence matching (characters appear in order)
    if is_subsequence(query, text):
        ratio = len(query) / len(text)
        if ratio > 0.6:
            return 60
        return 50
    
    return 0


def levenshtein_distance(s1, s2):
    """
    Calculate minimum edit distance between two strings
    (insertions, deletions, substitutions)
    """
    if len(s1) > len(s2):
        s1, s2 = s2, s1
    
    distances = range(len(s1) + 1)
    for i2, c2 in enumerate(s2):
        distances_ = [i2 + 1]
        for i1, c1 in enumerate(s1):
            if c1 == c2:
                distances_.append(distances[i1])
            else:
                distances_.append(1 + min((distances[i1], distances[i1 + 1], distances_[-1])))
        distances = distances_
    
    return distances[-1]


def is_subsequence(query, text):
    """Check if query characters appear in order in text"""
    it = iter(text)
    return all(c in it for c in query)


def fuzzy_search_students(query, teacher=None, limit=20):
    """
    Fuzzy search for students with typo tolerance
    """
    if not query or len(query) < 2:
        return []
    
    query = query.strip()
    
    # Build base queryset
    students = Student.objects.select_related('user').all()
    
    # If teacher provided, filter to only their classes
    if teacher:
        from apps.teachers.models import TeacherAssignment
        teacher_assignments = TeacherAssignment.objects.filter(
            teacher=teacher,
            is_active=True
        )
        
        # Get all grade-section combinations teacher has access to
        grade_sections = [(a.grade, a.section) for a in teacher_assignments]
        
        if grade_sections:
            q_objects = Q()
            for grade, section in grade_sections:
                q_objects |= Q(
                    enrollments__grade=grade,
                    enrollments__section=section,
                    enrollments__status='ACTIVE'
                )
            students = students.filter(q_objects).distinct()
    
    # Annotate with full name for searching
    students = students.annotate(
        full_name=Concat('user__first_name', Value(' '), 'user__last_name', output_field=CharField())
    )
    
    # Multiple search strategies for maximum coverage
    search_patterns = []
    
    # 1. Original query
    search_patterns.append(query)
    
    # 2. Split query into words for multi-word names
    words = query.split()
    for word in words:
        if len(word) >= 2:
            search_patterns.append(word)
    
    # 3. Add variations for common typos (substring matching)
    if len(query) >= 3:
        # Add prefix matches (first N-1 characters) - catches missing last letter
        search_patterns.append(query[:-1])
        # Add suffix matches (skip first character) - catches extra first letter  
        if len(query) >= 4:
            search_patterns.append(query[1:])
        # Add middle substring (skip first and last) - catches extra letters at ends
        if len(query) >= 5:
            search_patterns.append(query[1:-1])
        # Add consonant-only pattern for vowel variations (Ayyan -> Ayn finds Ayaan)
        consonants = ''.join([c for c in query if c.lower() not in 'aeiou'])
        if len(consonants) >= 2:
            search_patterns.append(consonants)
    
    # Build Q objects for all patterns - use very broad matching
    q_objects = Q()
    for pattern in search_patterns:
        if len(pattern) >= 2:  # Only search patterns with 2+ chars
            q_objects |= (
                Q(user__first_name__icontains=pattern) |
                Q(user__last_name__icontains=pattern) |
                Q(suid__icontains=pattern) |
                Q(user__email__icontains=pattern) |
                Q(full_name__icontains=pattern)
            )
    
    # Execute search
    results = students.filter(q_objects)[:limit * 2]  # Get extra for scoring
    
    # Score and sort results
    scored_results = []
    for student in results:
        # Calculate best score from all searchable fields
        first_name = student.user.first_name if student.user else ''
        last_name = student.user.last_name if student.user else ''
        full_name = f"{first_name} {last_name}"
        
        scores = [
            calculate_similarity(query, first_name),
            calculate_similarity(query, last_name),
            calculate_similarity(query, student.suid or ''),
            calculate_similarity(query, full_name),
        ]
        
        # For multi-word queries, check individual words against both names
        for word in words:
            if len(word) >= 2:
                scores.append(calculate_similarity(word, first_name))
                scores.append(calculate_similarity(word, last_name))
        
        # IMPORTANT: Also check query against individual name words
        # This catches typos in first/last names
        name_words = full_name.split()
        for name_word in name_words:
            if len(name_word) >= 2:
                scores.append(calculate_similarity(query, name_word))
        
        max_score = max(scores) if scores else 0
        
        if max_score >= 50:  # Lowered threshold for better typo tolerance
            # Get enrollment info
            enrollment = student.enrollments.filter(status='ACTIVE').first()
            
            scored_results.append({
                'id': student.id,
                'name': f"{first_name} {last_name}",
                'suid': student.suid,
                'email': student.user.email if student.user else '',
                'grade': enrollment.grade if enrollment else '',
                'section': enrollment.section if enrollment else '',
                'roll_number': enrollment.roll_number if enrollment else '',
                'photo': student.profile_photo.url if student.profile_photo else None,
                'score': max_score,
                'type': 'student'
            })
    
    # Sort by score descending
    scored_results.sort(key=lambda x: x['score'], reverse=True)
    
    return scored_results[:limit]


def fuzzy_search_teachers(query, limit=20):
    """
    Fuzzy search for teachers
    """
    if not query or len(query) < 2:
        return []
    
    query = query.strip()
    
    # Build base queryset
    teachers = Teacher.objects.select_related('user').all()
    
    # Annotate with full name
    teachers = teachers.annotate(
        full_name=Concat('user__first_name', Value(' '), 'user__last_name', output_field=CharField())
    )
    
    # Multiple search patterns
    words = query.split()
    search_patterns = words + [query]
    
    # Build Q objects
    q_objects = Q()
    for pattern in search_patterns:
        if len(pattern) >= 2:
            q_objects |= (
                Q(user__first_name__icontains=pattern) |
                Q(user__last_name__icontains=pattern) |
                Q(user__email__icontains=pattern) |
                Q(user__username__icontains=pattern) |
                Q(employee_id__icontains=pattern) |
                Q(department__icontains=pattern) |
                Q(full_name__icontains=pattern)
            )
    
    # Execute search
    results = teachers.filter(q_objects)[:limit * 2]
    
    # Score and sort
    scored_results = []
    for teacher in results:
        scores = [
            calculate_similarity(query, teacher.user.first_name or ''),
            calculate_similarity(query, teacher.user.last_name or ''),
            calculate_similarity(query, teacher.employee_id or ''),
            calculate_similarity(query, f"{teacher.user.first_name} {teacher.user.last_name}"),
        ]
        
        for word in words:
            scores.append(calculate_similarity(word, teacher.user.first_name or ''))
            scores.append(calculate_similarity(word, teacher.user.last_name or ''))
        
        max_score = max(scores)
        
        if max_score >= 50:
            scored_results.append({
                'id': teacher.id,
                'name': f"{teacher.user.first_name} {teacher.user.last_name}",
                'email': teacher.user.email,
                'employee_id': teacher.employee_id,
                'department': teacher.department or '',
                'phone': teacher.phone or '',
                'photo': teacher.photo.url if teacher.photo else None,
                'score': max_score,
                'type': 'teacher'
            })
    
    scored_results.sort(key=lambda x: x['score'], reverse=True)
    
    return scored_results[:limit]


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def smart_search(request):
    """
    Universal smart search endpoint with fuzzy matching
    Handles typos, spelling mistakes, keyboard mismatches
    
    Query params:
    - q: search query (required)
    - type: 'student' | 'teacher' | 'all' (default: based on user role)
    - limit: max results per type (default: 10)
    """
    query = request.query_params.get('q', '').strip()
    search_type = request.query_params.get('type', 'auto')
    limit = int(request.query_params.get('limit', 10))
    
    if not query or len(query) < 2:
        return Response({
            'error': 'Query must be at least 2 characters',
            'results': []
        }, status=400)
    
    results = {
        'query': query,
        'students': [],
        'teachers': [],
        'total': 0
    }
    
    # Determine what to search based on user role
    user = request.user
    is_admin = user.is_staff or user.is_superuser
    
    try:
        teacher = Teacher.objects.get(user=user)
        is_teacher = True
    except Teacher.DoesNotExist:
        teacher = None
        is_teacher = False
    
    # Auto-detect search type
    if search_type == 'auto':
        if is_admin:
            search_type = 'all'
        elif is_teacher:
            search_type = 'student'
        else:
            search_type = 'student'
    
    # Perform searches
    if search_type in ['student', 'all']:
        results['students'] = fuzzy_search_students(query, teacher if is_teacher else None, limit)
    
    if search_type in ['teacher', 'all'] and is_admin:
        results['teachers'] = fuzzy_search_teachers(query, limit)
    
    results['total'] = len(results['students']) + len(results['teachers'])
    
    # If no results, provide helpful message
    if results['total'] == 0:
        results['message'] = f"No results found for '{query}'. Try different keywords or check spelling."
    
    return Response(results)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def quick_student_search(request):
    """
    Quick student search for dropdowns/autocomplete
    Returns minimal info for performance
    """
    query = request.query_params.get('q', '').strip()
    limit = int(request.query_params.get('limit', 5))
    
    if not query or len(query) < 2:
        return Response([])
    
    try:
        teacher = Teacher.objects.get(user=request.user)
    except Teacher.DoesNotExist:
        teacher = None
    
    results = fuzzy_search_students(query, teacher, limit)
    
    # Return minimal info
    quick_results = [{
        'id': r['id'],
        'name': r['name'],
        'suid': r['suid'],
        'class': f"{r['grade']}-{r['section']}" if r['grade'] else '',
    } for r in results]
    
    return Response(quick_results)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_class_students(request):
    """
    Get all students in a specific class
    Query params:
    - grade: Grade level (e.g., '9', '10')
    - section: Section letter (e.g., 'A', 'B')
    """
    grade = request.query_params.get('grade', '').strip()
    section = request.query_params.get('section', '').strip()
    
    if not grade or not section:
        return Response({
            'error': 'Both grade and section are required'
        }, status=400)
    
    try:
        # Check if teacher has access to this class
        teacher = Teacher.objects.get(user=request.user)
        
        # Verify teacher teaches this class
        has_access = TeacherAssignment.objects.filter(
            teacher=teacher,
            grade=grade,
            section=section,
            is_active=True
        ).exists()
        
        if not has_access:
            return Response({
                'error': 'You do not have access to this class'
            }, status=403)
        
    except Teacher.DoesNotExist:
        # Admin or non-teacher user
        pass
    
    # Get all active students in this class
    enrollments = StudentEnrollment.objects.filter(
        grade=grade,
        section=section,
        status='ACTIVE'
    ).select_related('student', 'student__user').order_by('roll_number')
    
    students = []
    for enrollment in enrollments:
        student = enrollment.student
        if student.user:
            students.append({
                'id': student.id,
                'name': f"{student.user.first_name} {student.user.last_name}",
                'suid': student.suid,
                'grade': enrollment.grade,
                'section': enrollment.section,
                'roll_number': enrollment.roll_number,
                'photo': student.profile_photo.url if student.profile_photo else None,
            })
    
    return Response({
        'grade': grade,
        'section': section,
        'total': len(students),
        'students': students
    })
