'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import {
  BookOpen, Users, Calendar, FileText, BarChart3,
  Settings, ArrowRight, Loader2, AlertCircle, BookMarked, PenTool
} from 'lucide-react';
import { usePermissionContext } from '@/lib/rbac-context';

interface AcademicStats {
  total_grades: number;
  total_sections: number;
  total_subjects: number;
  active_exams: number;
  total_students: number;
}

export default function AcademicsPage() {
  const [stats, setStats] = useState<AcademicStats | null>(null);
  const [loading, setLoading] = useState(true);
  const { hasPermission, isAdmin } = usePermissionContext();

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Fetch statistics for the dashboard
        const [gradesRes, sectionsRes, subjectsRes, examsRes] = await Promise.all([
          api.get('/academics/grades/'),
          api.get('/academics/sections/'),
          api.get('/academics/subjects/'),
          api.get('/academics/exams/')
        ]);

        setStats({
          total_grades: gradesRes.data.length,
          total_sections: sectionsRes.data.length,
          total_subjects: subjectsRes.data.length,
          active_exams: examsRes.data.length,
          total_students: 0 // Will be calculated from enrollments
        });
      } catch (error) {
        console.error('Failed to load academic stats', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const academicModules = [
    {
      icon: <Users size={32} className="text-blue-600" />,
      title: 'Classes & Sections',
      description: 'Manage grades, sections, and class hierarchies',
      path: '/dashboard/academics/classes',
      color: 'bg-blue-50 border-blue-200'
    },
    {
      icon: <BookOpen size={32} className="text-purple-600" />,
      title: 'Subjects',
      description: 'Define and manage subjects with code mappings',
      path: '/dashboard/academics/subjects',
      color: 'bg-purple-50 border-purple-200'
    },
    {
      icon: <Calendar size={32} className="text-green-600" />,
      title: 'Timetable',
      description: 'Create and manage class schedules and periods',
      path: '/dashboard/academics/timetable',
      color: 'bg-green-50 border-green-200'
    },
    {
      icon: <BookMarked size={32} className="text-orange-600" />,
      title: 'Syllabus',
      description: 'Track chapter progress and academic planning',
      path: '/dashboard/academics/syllabus',
      color: 'bg-orange-50 border-orange-200'
    },
    {
      icon: <BarChart3 size={32} className="text-blue-600" />,
      title: 'Exams',
      description: 'Create exams for grades - auto-applies to all sections',
      path: '/dashboard/academics/exams',
      color: 'bg-blue-50 border-blue-200'
    },
    {
      icon: <FileText size={32} className="text-indigo-600" />,
      title: 'Results',
      description: 'Record marks and generate report cards',
      path: '/dashboard/academics/results',
      color: 'bg-indigo-50 border-indigo-200'
    },
    {
      icon: <PenTool size={32} className="text-cyan-600" />,
      title: 'Marks Entry',
      description: 'Enter and manage student exam marks',
      path: '/dashboard/academics/marks-entry',
      color: 'bg-cyan-50 border-cyan-200'
    }
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-8 rounded-2xl shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
              <BookOpen size={40} /> Academic Management
            </h1>
            <p className="text-blue-100">Manage classes, subjects, timetables, syllabus, exams, and results</p>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      {loading ? (
        <div className="flex justify-center items-center p-12">
          <Loader2 className="animate-spin text-blue-600" size={40} />
        </div>
      ) : stats ? (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatCard label="Grades" value={stats.total_grades} color="bg-blue-500" />
          <StatCard label="Sections" value={stats.total_sections} color="bg-green-500" />
          <StatCard label="Subjects" value={stats.total_subjects} color="bg-purple-500" />
          <StatCard label="Active Exams" value={stats.active_exams} color="bg-red-500" />
          <StatCard label="Students" value={stats.total_students} color="bg-yellow-500" />
        </div>
      ) : null}

      {/* Academic Modules Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {academicModules.map((module, index) => (
          <Link
            key={index}
            href={module.path}
            className={`border-2 ${module.color} p-6 rounded-xl hover:shadow-lg hover:scale-105 transition-all duration-200 cursor-pointer group`}
          >
            <div className="flex items-start justify-between mb-4">
              <div>{module.icon}</div>
              <ArrowRight size={20} className="text-gray-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">{module.title}</h3>
            <p className="text-gray-600 text-sm">{module.description}</p>
          </Link>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Settings size={24} className="text-blue-600" />
          Quick Setup Guide
        </h2>
        <div className="grid md:grid-cols-3 gap-4 text-sm">
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <p className="font-bold text-blue-900 mb-2">1. Create Grades & Sections</p>
            <p className="text-blue-700">Define your school's grade structure (1-12) and sections (A, B, C)</p>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
            <p className="font-bold text-purple-900 mb-2">2. Setup Subjects & Teachers</p>
            <p className="text-purple-700">Map subjects to sections and assign teachers</p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg border border-green-200">
            <p className="font-bold text-green-900 mb-2">3. Create Timetable & Syllabus</p>
            <p className="text-green-700">Schedule periods and track syllabus progress</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={`${color} text-white rounded-xl p-4 shadow-md`}>
      <div className="text-sm font-semibold opacity-90">{label}</div>
      <div className="text-3xl font-bold">{value}</div>
    </div>
  );
}
