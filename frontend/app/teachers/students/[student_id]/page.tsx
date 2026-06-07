'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import axios from 'axios';
import { 
  ArrowLeft, User, Mail, Phone, MapPin, Calendar, 
  GraduationCap, Heart, Activity
} from 'lucide-react';

interface StudentDetail {
  id: number;
  suid: string;
  user: {
    full_name: string;
    email: string;
    phone_number: string;
  };
  photo?: string;
  date_of_birth: string | null;
  blood_group: string;
  address: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
}

export default function StudentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [student, setStudent] = useState<StudentDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStudent();
  }, []);

  const fetchStudent = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await axios.get(
        `http://localhost:8000/api/v1/teachers/students/${params.student_id}/`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setStudent(response.data);
    } catch (error) {
      console.error('Failed to fetch student', error);
      alert('Failed to load student details');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-600">Loading student...</div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="p-6">
        <div className="text-center text-gray-600">Student not found</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <ArrowLeft size={24} />
        </button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Student Profile</h1>
          <p className="text-gray-600 mt-1">View student information</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Photo */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex flex-col items-center">
              {student.photo ? (
                <img
                  src={`http://localhost:8000${student.photo}`}
                  alt={student.user.full_name}
                  className="w-32 h-32 rounded-full object-cover"
                />
              ) : (
                <div className="w-32 h-32 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white text-4xl font-bold">
                  {student.user.full_name.split(' ').map(n => n[0]).join('')}
                </div>
              )}
              <div className="text-center mt-4">
                <div className="text-xl font-bold text-gray-900">{student.user.full_name}</div>
                <div className="text-gray-600 text-sm mt-1">{student.suid}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Personal Information */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <User size={20} />
              Personal Information
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                  <Mail size={14} />
                  Email
                </label>
                <div className="text-gray-900">{student.user.email || 'Not provided'}</div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                  <Phone size={14} />
                  Phone
                </label>
                <div className="text-gray-900">{student.user.phone_number || 'Not provided'}</div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                  <Calendar size={14} />
                  Date of Birth
                </label>
                <div className="text-gray-900">
                  {student.date_of_birth ? new Date(student.date_of_birth).toLocaleDateString('en-IN') : 'Not provided'}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                  <Activity size={14} />
                  Blood Group
                </label>
                <div className="text-gray-900">{student.blood_group || 'Not provided'}</div>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                  <MapPin size={14} />
                  Address
                </label>
                <div className="text-gray-900">{student.address || 'Not provided'}</div>
              </div>
            </div>
          </div>

          {/* Emergency Contact */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Heart size={20} />
              Emergency Contact
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contact Name</label>
                <div className="text-gray-900">{student.emergency_contact_name || 'Not provided'}</div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contact Phone</label>
                <div className="text-gray-900">{student.emergency_contact_phone || 'Not provided'}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
