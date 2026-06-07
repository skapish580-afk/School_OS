'use client';

import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { 
  User, Mail, Phone, MapPin, Calendar, Briefcase, 
  BookOpen, Award, Edit, Save, X, Camera 
} from 'lucide-react';

interface TeacherProfile {
  id: number;
  tuid: string;
  full_name: string;
  email: string;
  phone: string;
  date_of_birth: string | null;
  gender: string;
  qualifications: string;
  certified_subjects: string;
  experience_years: number;
  awards: string;
  photo?: string;
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<TeacherProfile | null>(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await axios.get(
        'http://localhost:8000/api/v1/teachers/me/',
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setProfile(response.data);
    } catch (error) {
      console.error('Failed to fetch profile', error);
      alert('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const token = localStorage.getItem('access_token');
      const formData = new FormData();
      formData.append('photo', file);

      const response = await axios.post(
        'http://localhost:8000/api/v1/teachers/me/upload-photo/',
        formData,
        { 
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          } 
        }
      );
      setProfile(response.data);
      alert('Photo uploaded successfully!');
    } catch (error) {
      console.error('Photo upload failed', error);
      alert('Failed to upload photo');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await axios.patch(
        'http://localhost:8000/api/v1/teachers/me/',
        profile,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setProfile(response.data);
      alert('Profile updated successfully!');
      setEditing(false);
    } catch (error) {
      console.error('Failed to save profile', error);
      alert('Failed to save profile');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-600">Loading profile...</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="p-6">
        <div className="text-center text-gray-600">Profile not found</div>
      </div>
    );
  }

  const subjects = profile.certified_subjects ? profile.certified_subjects.split(',').map(s => s.trim()) : [];

  return (
    <div className="p-6 space-y-6">
      <input
        type="file"
        ref={photoInputRef}
        onChange={handlePhotoUpload}
        accept="image/*"
        className="hidden"
      />
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My Profile</h1>
          <p className="text-gray-600 mt-1">View and update your information</p>
        </div>
        <div className="flex gap-3">
          {editing ? (
            <>
              <button
                onClick={() => setEditing(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
              >
                <X size={20} />
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="bg-green-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-green-700 flex items-center gap-2"
              >
                <Save size={20} />
                Save Changes
              </button>
            </>
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="bg-green-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-green-700 flex items-center gap-2"
            >
              <Edit size={20} />
              Edit Profile
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Photo & Stats */}
        <div className="lg:col-span-1 space-y-6">
          {/* Photo Card */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex flex-col items-center relative">
              {profile.photo ? (
                <img
                  src={`http://localhost:8000${profile.photo}`}
                  alt={profile.full_name}
                  className="w-32 h-32 rounded-full object-cover"
                />
              ) : (
                <div className="w-32 h-32 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center text-white text-4xl font-bold">
                  {profile.full_name.split(' ').map(n => n[0]).join('')}
                </div>
              )}
              <button
                onClick={() => photoInputRef.current?.click()}
                disabled={uploading}
                className="absolute top-0 right-1/2 translate-x-1/2 mt-24 bg-white border border-gray-300 p-2 rounded-full shadow-lg hover:bg-gray-50 disabled:opacity-50"
                title="Upload photo"
              >
                <Camera size={18} />
              </button>
              <div className="text-center mt-4">
                <div className="text-xl font-bold text-gray-900">{profile.full_name}</div>
                <div className="text-gray-600 text-sm mt-1">{profile.tuid}</div>
                <div className="text-green-600 text-sm font-medium mt-1">{profile.gender === 'M' ? 'Male' : profile.gender === 'F' ? 'Female' : 'Other'}</div>
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg border border-blue-200 p-6">
            <div className="space-y-4">
              <div>
                <div className="text-3xl font-bold text-blue-700">{profile.experience_years}</div>
                <div className="text-blue-600 text-sm">Years of Experience</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-blue-700">{subjects.length}</div>
                <div className="text-blue-600 text-sm">Certified Subjects</div>
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
                <div className="text-gray-900">{profile.email}</div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                  <Phone size={14} />
                  Phone
                </label>
                <div className="text-gray-900">{profile.phone}</div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                  <Calendar size={14} />
                  Date of Birth
                </label>
                {editing && profile.date_of_birth ? (
                  <input
                    type="date"
                    value={profile.date_of_birth}
                    onChange={(e) => setProfile({ ...profile, date_of_birth: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                ) : (
                  <div className="text-gray-900">{profile.date_of_birth ? new Date(profile.date_of_birth).toLocaleDateString('en-IN') : 'Not set'}</div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Experience (years)</label>
                {editing ? (
                  <input
                    type="number"
                    value={profile.experience_years}
                    onChange={(e) => setProfile({ ...profile, experience_years: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                ) : (
                  <div className="text-gray-900">{profile.experience_years} years</div>
                )}
              </div>
            </div>
          </div>

          {/* Professional Information */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Award size={20} />
              Professional Information
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Qualifications</label>
                {editing ? (
                  <textarea
                    value={profile.qualifications}
                    onChange={(e) => setProfile({ ...profile, qualifications: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="e.g., M.Sc. Mathematics, B.Ed."
                  />
                ) : (
                  <div className="text-gray-900">{profile.qualifications || 'Not specified'}</div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Certified Subjects</label>
                {editing ? (
                  <input
                    type="text"
                    value={profile.certified_subjects}
                    onChange={(e) => setProfile({ ...profile, certified_subjects: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="Mathematics, Physics, Chemistry"
                  />
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {subjects.map(subject => (
                      <span key={subject} className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                        {subject}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Awards & Recognition</label>
                {editing ? (
                  <textarea
                    value={profile.awards}
                    onChange={(e) => setProfile({ ...profile, awards: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="Professional awards and recognitions"
                  />
                ) : (
                  <div className="text-gray-900">{profile.awards || 'None listed'}</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
