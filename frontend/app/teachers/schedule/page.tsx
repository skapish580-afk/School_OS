'use client';

import { useState, useEffect } from 'react';
import { Clock, Calendar, Users, BookOpen, ChevronLeft, ChevronRight } from 'lucide-react';

interface ClassSchedule {
  id: string;
  day: string;
  period: number;
  start_time: string;
  end_time: string;
  subject: string;
  grade: string;
  section: string;
  room: string;
  student_count: number;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const PERIODS = [
  { number: 1, start: '08:30', end: '09:30' },
  { number: 2, start: '09:30', end: '10:30' },
  { number: 3, start: '10:30', end: '11:30' },
  { number: 4, start: '11:30', end: '12:30' },
  { number: 5, start: '13:00', end: '14:00' },
  { number: 6, start: '14:00', end: '15:00' }
];

export default function SchedulePage() {
  const [schedule, setSchedule] = useState<ClassSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWeek, setSelectedWeek] = useState(new Date());

  useEffect(() => {
    fetchSchedule();
  }, [selectedWeek]);

  const fetchSchedule = async () => {
    try {
      // Mock data - TODO: Connect to real API
      const mockSchedule: ClassSchedule[] = [
        // Monday
        { id: '1', day: 'Monday', period: 1, start_time: '08:30', end_time: '09:30', 
          subject: 'Mathematics', grade: '9', section: 'B', room: '201', student_count: 40 },
        { id: '2', day: 'Monday', period: 2, start_time: '09:30', end_time: '10:30', 
          subject: 'Mathematics', grade: '10', section: 'A', room: '301', student_count: 38 },
        { id: '3', day: 'Monday', period: 4, start_time: '11:30', end_time: '12:30', 
          subject: 'Physics', grade: '11', section: 'A', room: '401', student_count: 35 },
        
        // Tuesday
        { id: '4', day: 'Tuesday', period: 1, start_time: '08:30', end_time: '09:30', 
          subject: 'Mathematics', grade: '9', section: 'A', room: '201', student_count: 42 },
        { id: '5', day: 'Tuesday', period: 3, start_time: '10:30', end_time: '11:30', 
          subject: 'Mathematics', grade: '9', section: 'B', room: '201', student_count: 40 },
        { id: '6', day: 'Tuesday', period: 5, start_time: '13:00', end_time: '14:00', 
          subject: 'Physics', grade: '11', section: 'B', room: '401', student_count: 33 },
        
        // Wednesday
        { id: '7', day: 'Wednesday', period: 2, start_time: '09:30', end_time: '10:30', 
          subject: 'Mathematics', grade: '10', section: 'A', room: '301', student_count: 38 },
        { id: '8', day: 'Wednesday', period: 4, start_time: '11:30', end_time: '12:30', 
          subject: 'Mathematics', grade: '9', section: 'A', room: '201', student_count: 42 },
        
        // Thursday
        { id: '9', day: 'Thursday', period: 1, start_time: '08:30', end_time: '09:30', 
          subject: 'Physics', grade: '11', section: 'A', room: '401', student_count: 35 },
        { id: '10', day: 'Thursday', period: 3, start_time: '10:30', end_time: '11:30', 
          subject: 'Mathematics', grade: '9', section: 'B', room: '201', student_count: 40 },
        
        // Friday
        { id: '11', day: 'Friday', period: 2, start_time: '09:30', end_time: '10:30', 
          subject: 'Mathematics', grade: '10', section: 'A', room: '301', student_count: 38 },
        { id: '12', day: 'Friday', period: 5, start_time: '13:00', end_time: '14:00', 
          subject: 'Physics', grade: '11', section: 'B', room: '401', student_count: 33 },
      ];

      setSchedule(mockSchedule);
    } catch (error) {
      console.error('Failed to fetch schedule', error);
    } finally {
      setLoading(false);
    }
  };

  const getClassForSlot = (day: string, period: number) => {
    return schedule.find(s => s.day === day && s.period === period);
  };

  const getWeekRange = () => {
    const start = new Date(selectedWeek);
    start.setDate(start.getDate() - start.getDay() + 1); // Monday
    const end = new Date(start);
    end.setDate(end.getDate() + 5); // Saturday
    return `${start.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} - ${end.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  };

  const totalClasses = schedule.length;
  const totalStudents = schedule.reduce((sum, cls) => sum + cls.student_count, 0);
  const subjects = [...new Set(schedule.map(s => s.subject))];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-600">Loading schedule...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My Schedule</h1>
          <p className="text-gray-600 mt-1">Weekly timetable and class assignments</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              const newDate = new Date(selectedWeek);
              newDate.setDate(newDate.getDate() - 7);
              setSelectedWeek(newDate);
            }}
            className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="px-4 py-2 bg-gray-100 rounded-lg font-medium">
            {getWeekRange()}
          </div>
          <button
            onClick={() => {
              const newDate = new Date(selectedWeek);
              newDate.setDate(newDate.getDate() + 7);
              setSelectedWeek(newDate);
            }}
            className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg border border-blue-200">
          <div className="flex items-center gap-3">
            <BookOpen className="h-8 w-8 text-blue-600" />
            <div>
              <div className="text-2xl font-bold text-blue-700">{totalClasses}</div>
              <div className="text-blue-600 text-sm">Classes This Week</div>
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-lg border border-green-200">
          <div className="flex items-center gap-3">
            <Users className="h-8 w-8 text-green-600" />
            <div>
              <div className="text-2xl font-bold text-green-700">{totalStudents}</div>
              <div className="text-green-600 text-sm">Total Students</div>
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-lg border border-purple-200">
          <div className="flex items-center gap-3">
            <Calendar className="h-8 w-8 text-purple-600" />
            <div>
              <div className="text-2xl font-bold text-purple-700">{subjects.length}</div>
              <div className="text-purple-600 text-sm">Subjects</div>
            </div>
          </div>
        </div>
      </div>

      {/* Timetable Grid */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 w-32">Period</th>
              {DAYS.map(day => (
                <th key={day} className="px-4 py-3 text-center text-sm font-semibold text-gray-700">
                  {day}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {PERIODS.map(period => (
              <tr key={period.number} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm">
                  <div className="font-semibold text-gray-900">Period {period.number}</div>
                  <div className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                    <Clock size={12} />
                    {period.start} - {period.end}
                  </div>
                </td>
                {DAYS.map(day => {
                  const classInfo = getClassForSlot(day, period.number);
                  
                  return (
                    <td key={day} className="px-2 py-2">
                      {classInfo ? (
                        <div className="bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-lg p-3 hover:shadow-md transition-shadow">
                          <div className="font-semibold text-gray-900 text-sm mb-1">
                            {classInfo.subject}
                          </div>
                          <div className="text-xs text-gray-600 space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="font-medium">Grade {classInfo.grade}{classInfo.section}</span>
                              <span className="flex items-center gap-1">
                                <Users size={12} />
                                {classInfo.student_count}
                              </span>
                            </div>
                            <div className="text-gray-500">Room: {classInfo.room}</div>
                          </div>
                        </div>
                      ) : (
                        <div className="h-20 bg-gray-50 rounded-lg flex items-center justify-center">
                          <span className="text-xs text-gray-400">Free</span>
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Subject-wise Breakdown */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Subject-wise Breakdown</h2>
        <div className="space-y-3">
          {subjects.map(subject => {
            const classes = schedule.filter(s => s.subject === subject);
            const totalStudents = classes.reduce((sum, cls) => sum + cls.student_count, 0);
            const sections = [...new Set(classes.map(s => `${s.grade}-${s.section}`))];
            
            return (
              <div key={subject} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <div className="font-semibold text-gray-900">{subject}</div>
                  <div className="text-sm text-gray-600 mt-1">
                    {sections.join(', ')}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-gray-900">{classes.length}</div>
                  <div className="text-xs text-gray-500">{totalStudents} students</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
