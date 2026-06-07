'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { ArrowLeft, User, Search, Hash, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function ClassDetailsPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { id } = params; 
  
  const decodedId = decodeURIComponent(id);
  const [grade, section] = decodedId.includes('-') ? decodedId.split('-') : [decodedId, ''];

  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchClassStudents = async () => {
      try {
        const response = await api.get(`/enrollments/?grade=${grade}&section=${section}&status=ACTIVE`);
        const data = Array.isArray(response.data) ? response.data : (response.data.results || []);
        setStudents(data);
      } catch (error) {
        console.error("Failed to fetch class details", error);
      } finally {
        setLoading(false);
      }
    };

    if (grade) {
      fetchClassStudents();
    }
  }, [grade, section]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button 
          onClick={() => router.back()}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200 bg-white"
        >
          <ArrowLeft size={20} className="text-gray-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Grade {grade} - Section {section}</h1>
          <p className="text-gray-500 text-sm">Class Roster & Management</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-700">Students</span>
            <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full font-bold">
              {students.length}
            </span>
          </div>
        </div>

        {loading ? (
          <div className="p-12 flex justify-center">
             <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : students.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center">
            <User className="text-gray-300 mb-3" size={32} />
            <p className="text-gray-500 font-medium">No active students found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-semibold border-b border-gray-100">
                <tr>
                  <th className="px-6 py-4 w-24">Roll No</th>
                  <th className="px-6 py-4">Student Name</th>
                  <th className="px-6 py-4 text-center">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {students.map((enrollment) => (
                  <tr key={enrollment.id} className="hover:bg-gray-50 transition-colors group">
                    <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-gray-600 font-mono text-sm font-medium bg-gray-50 px-2 py-1 rounded w-fit">
                            <Hash size={12} className="opacity-50" />
                            {enrollment.roll_number || "-"}
                        </div>
                    </td>
                    
                    {/* CLICKABLE NAME SECTION */}
                    <td className="px-6 py-4">
                      <Link href={`/dashboard/students/${enrollment.student}`} className="block">
                          <div className="flex items-center gap-3 cursor-pointer">
                            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-100 to-blue-50 flex items-center justify-center text-blue-600 text-xs font-bold border border-blue-100">
                              {enrollment.student_name ? enrollment.student_name[0] : <User size={16} />}
                            </div>
                            <div>
                                <p className="font-semibold text-gray-800 text-sm hover:text-blue-600 transition-colors">
                                    {enrollment.student_name || "Unknown Student"}
                                </p>
                                <p className="text-xs text-gray-400">ID: {enrollment.student}</p>
                            </div>
                          </div>
                      </Link>
                    </td>

                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center bg-green-50 text-green-700 text-xs px-2.5 py-1 rounded-full font-medium border border-green-100">
                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1.5 animate-pulse"></span>
                        {enrollment.status}
                      </span>
                    </td>

                    {/* CLICKABLE ACTION BUTTON */}
                    <td className="px-6 py-4 text-right">
                        <Link 
                            href={`/dashboard/students/${enrollment.student}`}
                            className="inline-flex items-center text-gray-400 hover:text-blue-600 font-medium text-sm transition-colors"
                        >
                            View Profile <ArrowRight size={14} className="ml-1" />
                        </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}