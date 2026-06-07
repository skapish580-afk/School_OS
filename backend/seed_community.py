import os
import sys
import django
import random
from datetime import datetime

# Initialize Django environment
sys.path.append(r'c:\Users\kapis\OneDrive\Documents\GitHub\SCHOO--main\backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from apps.schools.models import School
from apps.accounts.models import User
from apps.students.models import Student
from apps.community.models import ForumPost, ForumComment

def seed_community_data():
    print("=== Start Seeding Community Data ===")
    
    # 1. Update school cities for realistic search & filtering
    schools = list(School.objects.all())
    cities = ["Mumbai", "Delhi", "Bangalore", "Pune", "Chennai"]
    
    for i, school in enumerate(schools):
        city = cities[i % len(cities)]
        school.city = city
        school.state = "Maharashtra" if city in ["Mumbai", "Pune"] else "Karnataka" if city == "Bangalore" else "Delhi" if city == "Delhi" else "Tamil Nadu"
        school.save()
        print(f"Updated School: {school.name} with City: {school.city}")

    # 2. Get some users to act as authors (Teachers, Parents, Admins)
    users = list(User.objects.all())
    if not users:
        print("Error: No users in the database to act as authors. Please populate base data first.")
        return
        
    teachers = [u for u in users if u.user_type == 'TEACHER']
    parents = [u for u in users if u.user_type == 'PARENT']
    admins = [u for u in users if u.user_type in ['SCHOOL_ADMIN', 'ADMIN', 'PLATFORM_ADMIN']]
    
    # Fallback to any user if types are empty
    author_pool = teachers + parents + admins if (teachers + parents + admins) else users
    
    # 3. Create or convert some students to GRADUATED alumni with consent
    active_students = Student.objects.filter(status='ACTIVE')
    graduated_students = Student.objects.filter(status='GRADUATED')
    
    print(f"Current active students: {active_students.count()}")
    print(f"Current graduated students: {graduated_students.count()}")
    
    # If we have very few graduated students, let's mark a few active ones as graduated or update current graduated
    alumni_list = list(graduated_students)
    if len(alumni_list) < 5 and active_students.count() > 10:
        # Gracefully transition 8 students to graduated for demo directory
        to_graduate = list(active_students[:8])
        for s in to_graduate:
            s.status = 'GRADUATED'
            s.alumni_directory_consent = True
            s.graduation_date = datetime(2025, 5, 20).date()
            s.save()
            alumni_list.append(s)
            print(f"Graduated active student for demo: {s.full_name_display} ({s.school.name})")
    else:
        # Enable consent on all graduated
        for s in graduated_students:
            s.alumni_directory_consent = True
            s.save()
            print(f"Granted consent to existing graduate: {s.full_name_display}")
            
    # 4. Clean up old posts & comments to start fresh
    ForumComment.objects.all().delete()
    ForumPost.objects.all().delete()
    print("Cleared existing forum posts and comments.")
    
    # 5. Create realistic forum posts matching K-12 school theme & Parent Connect
    posts_data = [
        {
            "title": "Looking for recommendations for Class 10 Math Tutors in Andheri",
            "content": "Hi parents! My daughter is in Grade 10 and CBSE boards are coming up next year. Does anyone have recommendations for verified Math tutors or coaching centers around Andheri West? Appreciate the help!",
            "is_global": False,
            "city_localized": "Mumbai"
        },
        {
            "title": "Best school van/bus service operating in South Delhi?",
            "content": "Hello, we recently shifted to Saket. We are looking for private school van operators who have speed governors and verified drivers. If any parents from Saket are using a specific van service, please share the details.",
            "is_global": False,
            "city_localized": "Delhi"
        },
        {
            "title": "Olympiad Preparation: Tips for Science Olympiad (NSO)",
            "content": "A quick tip for parents whose children are preparing for the upcoming Science Olympiad. Start practicing past 5 years' papers. The focus should be on the 'Achievers Section' as it carries high weightage. Good luck to all students!",
            "is_global": True,
            "city_localized": ""
        },
        {
            "title": "Annual Sports Day preparation in full swing!",
            "content": "It is wonderful to see our kids practicing hard on the field every morning. Huge shoutout to the physical education instructors for organizing the drills so professionally. Looking forward to Friday's event!",
            "is_global": False,
            "city_localized": "" # School specific (will map to author's school)
        },
        {
            "title": "Preparing for College Admissions: Tips from an Alumni",
            "content": "Hey everyone, as an ex-student of NHSS currently studying Computer Science at IIT Bombay, I wanted to share a quick advice: do not neglect extracurricular portfolios. Top universities are looking at holistic profiles now, not just marksheets. Feel free to connect if you need career advice!",
            "is_global": True,
            "city_localized": ""
        }
    ]
    
    seeded_posts = []
    for p in posts_data:
        author = random.choice(author_pool)
        school = author.school if author.school else (schools[0] if schools else None)
        city = p["city_localized"] if p["city_localized"] else (school.city if school else "")
        
        post = ForumPost.objects.create(
            title=p["title"],
            content=p["content"],
            is_global=p["is_global"],
            city_localized=city,
            author=author,
            school=school
        )
        seeded_posts.append(post)
        print(f"Created Post: '{post.title}' by {author.full_name} ({school.name if school else 'No School'})")
        
    # 6. Add realistic comments/replies to the discussion posts
    comments_pool = [
        "This is an excellent question. I was about to ask the exact same thing!",
        "Thanks for sharing these valuable tips. Highly appreciated!",
        "Yes, we are in Saket as well. I will private-message you the phone number of the van supervisor we use. They have GPS tracking on their app.",
        "For Math, check out Apex Academy near the metro station. They have really small batch sizes and excellent individual attention.",
        "So true! Holistic profiles make a massive difference in admissions today. Thanks for the heads up!",
        "The kids have worked so hard! Cannot wait to cheer them on this Friday!"
    ]
    
    for post in seeded_posts:
        # Add 1 to 3 random comments per post
        num_comments = random.randint(1, 3)
        commenters = random.sample(author_pool, min(num_comments, len(author_pool)))
        for commenter in commenters:
            content = random.choice(comments_pool)
            comment = ForumComment.objects.create(
                post=post,
                author=commenter,
                content=content
            )
            print(f"  Comment by {commenter.full_name}: '{comment.content[:40]}...'")
            
    print("=== Community Data Seeding Completed Successfully ===")

if __name__ == '__main__':
    seed_community_data()
