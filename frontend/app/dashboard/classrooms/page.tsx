'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Users, ArrowRight, BookOpen, GraduationCap } from 'lucide-react';

interface Classroom {
  id: string;
  grade: string;
  section: string;
  studentCount: number;
}

export default function ClassroomsPage() {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchClassrooms = async () => {
      try {
        const response = await api.get('/enrollments/');
        const data = response.data;
        
        // --- SAFE DATA HANDLING ---
        // Handles both plain lists [] and paginated results { results: [] }
        const enrollments = Array.isArray(data) ? data : (data.results || []); 
        
        // Group data: { "10-A": 1, "9-B": 5 }
        const grouped: Record<string, number> = {};
        
        enrollments.forEach((enrollment: any) => {
          // Fallback if grade/section are missing
          const grade = enrollment.grade || "Unknown";
          const section = enrollment.section || "?";
          const key = `${grade}-${section}`;
          grouped[key] = (grouped[key] || 0) + 1;
        });

        // Convert back to array for display
        const roomArray = Object.keys(grouped).map((key) => {
          const [grade, section] = key.split('-');
          return {
            id: key,
            grade,
            section,
            studentCount: grouped[key]
          };
        });

        setClassrooms(roomArray);
      } catch (error) {
        console.error("Failed to fetch classrooms", error);
      } finally {
        setLoading(false);
      }
    };

    fetchClassrooms();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Classrooms</h1>
          <p className="text-gray-500 text-sm">Overview of all active grades and sections</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {loading ? (
          // Loading Skeletons
          [...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-gray-100 rounded-xl animate-pulse"></div>
          ))
        ) : classrooms.length === 0 ? (
          // Empty State
          <div className="col-span-full flex flex-col items-center justify-center p-12 bg-white rounded-xl border border-dashed border-gray-300 text-gray-400">
            <BookOpen size={48} className="mb-4 opacity-50" />
            <p>No active classrooms found.</p>
            <p className="text-sm mt-2">Enroll a student to create a class automatically.</p>
          </div>
        ) : (
          // Classroom Cards
          classrooms.map((room) => (
            <Link href={`/dashboard/classrooms/${room.id}`} key={room.id} className="block group">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all hover:-translate-y-1 cursor-pointer h-full relative overflow-hidden">
                
                <div className="flex justify-between items-start mb-4">
                  <div className="p-3 bg-blue-50 text-blue-600 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-colors">
                    <GraduationCap size={24} />
                  </div>
                  <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full font-medium">
                    Active
                  </span>
                </div>
                
                <h3 className="text-xl font-bold text-gray-800 mb-1">
                  Grade {room.grade} <span className="text-gray-400 font-light">|</span> {room.section}
                </h3>
                
                <div className="flex items-center text-gray-500 text-sm mb-4">
                  <Users size={16} className="mr-2" />
                  {room.studentCount} Student{room.studentCount !== 1 && 's'}
                </div>

                {/* Progress Bar Decoration */}
                <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 w-full opacity-70"></div>
                </div>
                
                <div className="mt-4 flex items-center text-blue-600 text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-6 right-6">
                  View <ArrowRight size={16} className="ml-1" />
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}