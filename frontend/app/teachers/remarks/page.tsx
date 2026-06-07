'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  MessageSquare, Plus, Search, Filter, AlertTriangle, 
  TrendingUp, Award, BookOpen, Clock, Eye, EyeOff, Sparkles, X, AlertCircle 
} from 'lucide-react';
import SmartSearch from '@/components/SmartSearch';

interface Student {
  id: string;
  suid: string;
  name: string;
  grade: string;
  section: string;
}

interface Remark {
  id: string;
  student_id: string;
  student_name: string;
  student_suid: string;
  category: 'ACADEMIC' | 'BEHAVIORAL' | 'IMPROVEMENT' | 'APPRECIATION';
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  context: string;
  details?: string;
  created_by?: string;
  teacher_name?: string;
  created_at: string;
  visible_to_parent: boolean;
}

const CATEGORIES = [
  { value: 'ACADEMIC', label: 'Academic', icon: BookOpen, color: 'blue' },
  { value: 'BEHAVIORAL', label: 'Behavioral', icon: AlertTriangle, color: 'red' },
  { value: 'IMPROVEMENT', label: 'Improvement', icon: TrendingUp, color: 'orange' },
  { value: 'APPRECIATION', label: 'Appreciation', icon: Award, color: 'green' }
];

const QUICK_CONTEXTS = {
  ACADEMIC: [
    'Incomplete homework',
    'Excellent performance in test',
    'Needs additional support',
    'Improved understanding of concepts',
    'Participated actively in class'
  ],
  BEHAVIORAL: [
    'Disruptive in class',
    'Late to class repeatedly',
    'Not following instructions',
    'Respectful and cooperative',
    'Helped fellow students'
  ],
  IMPROVEMENT: [
    'Showing progress in weak areas',
    'Attendance has improved',
    'More focused in class',
    'Better time management',
    'Taking initiative'
  ],
  APPRECIATION: [
    'Won competition',
    'Excellent project work',
    'Leadership qualities',
    'Consistent performance',
    'Outstanding behavior'
  ]
};

export default function RemarksPage() {
  const [remarks, setRemarks] = useState<Remark[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  
  // Class roster view
  const [showClassRoster, setShowClassRoster] = useState(false);
  const [classStudents, setClassStudents] = useState<Student[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  
  // New Remark Form
  const [newCategory, setNewCategory] = useState<string>('ACADEMIC');
  const [newContext, setNewContext] = useState('');
  const [newDetails, setNewDetails] = useState('');
  const [visibleToParent, setVisibleToParent] = useState(false);

  useEffect(() => {
    fetchRemarks();
  }, [selectedClass, filterCategory]);

  const fetchRemarks = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const params = new URLSearchParams();
      if (selectedClass && selectedClass !== 'all') params.append('class', selectedClass);
      if (filterCategory !== 'ALL') params.append('category', filterCategory);
      
      const response = await axios.get(
        `http://localhost:8000/api/v1/teachers/remarks/?${params.toString()}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setRemarks(response.data);
    } catch (error) {
      console.error('Failed to fetch remarks', error);
    }
  };

  const fetchClassStudents = async (classValue: string) => {
    if (!classValue) {
      setClassStudents([]);
      setShowClassRoster(false);
      return;
    }

    try {
      setLoadingStudents(true);
      const token = localStorage.getItem('access_token');
      
      // Parse class value (e.g., "9-B" -> grade=9, section=B)
      const [grade, section] = classValue.split('-');
      
      const response = await axios.get(
        `http://localhost:8000/api/v1/teachers/students/by-class/?grade=${grade}&section=${section}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // Map response to Student format
      const students = response.data.students.map((s: any) => ({
        id: s.id.toString(),
        name: s.name,
        suid: s.suid,
        grade: s.grade,
        section: s.section,
      }));
      
      setClassStudents(students);
      setShowClassRoster(true);
      setLoadingStudents(false);
    } catch (error: any) {
      console.error('Failed to fetch class students', error);
      if (error.response?.status === 403) {
        alert('You do not have access to this class');
      }
      setLoadingStudents(false);
      setShowClassRoster(false);
    }
  };

  const handleClassChange = (classValue: string) => {
    setSelectedClass(classValue);
    fetchClassStudents(classValue);
  };

  const handleAddRemark = async () => {
    if (!selectedStudent || !newContext) return;

    try {
      const token = localStorage.getItem('access_token');
      
      const payload = {
        student: selectedStudent.id,
        category: newCategory,
        severity: calculateSeverity(newCategory, newContext),
        context: newContext,
        details: newDetails,
        visible_to_parent: visibleToParent
      };

      await axios.post(
        'http://localhost:8000/api/v1/teachers/remarks/',
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // Refresh remarks list
      await fetchRemarks();
      resetForm();
      setShowAddModal(false);
    } catch (error: any) {
      console.error('Failed to add remark', error);
      alert(`Failed to add remark: ${error.response?.data?.error || error.message}`);
    }
  };

  const calculateSeverity = (category: string, context: string): 'LOW' | 'MEDIUM' | 'HIGH' => {
    if (category === 'APPRECIATION' || category === 'IMPROVEMENT') return 'LOW';
    if (context.toLowerCase().includes('repeatedly') || context.toLowerCase().includes('serious')) return 'HIGH';
    return 'MEDIUM';
  };

  const resetForm = () => {
    setNewCategory('ACADEMIC');
    setNewContext('');
    setNewDetails('');
    setVisibleToParent(false);
    setSelectedStudent(null);
  };

  const filteredRemarks = remarks.filter(r => {
    const matchesSearch = searchTerm === '' || 
      r.student_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.student_suid.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.context && r.context.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesSearch;
  });

  const getCategoryColor = (category: string) => {
    const cat = CATEGORIES.find(c => c.value === category);
    return cat?.color || 'gray';
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'HIGH': return 'red';
      case 'MEDIUM': return 'orange';
      case 'LOW': return 'blue';
      default: return 'gray';
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Student Remarks</h1>
          <p className="text-gray-600 mt-1">Quick incident tagging and behavior tracking</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 flex items-center gap-2"
        >
          <Plus size={20} />
          Add Remark
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {CATEGORIES.map(cat => {
          const count = remarks.filter(r => r.category === cat.value).length;
          const Icon = cat.icon;
          return (
            <div key={cat.value} className={`bg-${cat.color}-50 p-4 rounded-lg border border-${cat.color}-200`}>
              <div className="flex items-center gap-3">
                <Icon className={`h-8 w-8 text-${cat.color}-600`} />
                <div>
                  <div className={`text-2xl font-bold text-${cat.color}-700`}>{count}</div>
                  <div className={`text-${cat.color}-600 text-sm`}>{cat.label}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex gap-4">
          <div className="flex-1">
            <SmartSearch 
              placeholder="🔍 Smart Search: Find students (handles typos!)"
              onSelectStudent={(student) => {
                console.log('Selected student from search:', student);
                setSelectedStudent({
                  id: student.id.toString(),
                  name: student.name,
                  suid: student.suid || '',
                  grade: student.grade || '',
                  section: student.section || ''
                });
                setShowAddModal(true);
              }}
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter size={18} className="text-gray-500" />
            <select
              value={selectedClass}
              onChange={(e) => handleClassChange(e.target.value)}
              className="px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 font-medium"
            >
              <option value="">📋 Browse by Class...</option>
              <option value="9-A">Class 9-A</option>
              <option value="9-B">Class 9-B</option>
              <option value="10-A">Class 10-A</option>
            </select>
          </div>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
          >
            <option value="ALL">All Categories</option>
            {CATEGORIES.map(cat => (
              <option key={cat.value} value={cat.value}>{cat.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Class Roster View */}
      {showClassRoster && (
        <div className="bg-white rounded-lg border-2 border-green-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                Class {selectedClass} - All Students
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {classStudents.length} students • Click on any student to add a remark
              </p>
            </div>
            <button
              onClick={() => {
                setSelectedClass('');
                setShowClassRoster(false);
                setClassStudents([]);
              }}
              className="text-gray-500 hover:text-gray-700"
            >
              <X size={20} />
            </button>
          </div>

          {loadingStudents ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
                <div className="text-gray-600">Loading students...</div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {classStudents.map((student) => (
                <button
                  key={student.id}
                  onClick={() => {
                    setSelectedStudent(student);
                    setShowAddModal(true);
                  }}
                  className="flex items-center gap-3 p-4 bg-gray-50 hover:bg-green-50 rounded-lg border border-gray-200 hover:border-green-400 transition-all group text-left"
                >
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-md group-hover:scale-110 transition-transform">
                    {student.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-gray-900 truncate group-hover:text-green-700">
                      {student.name}
                    </div>
                    <div className="text-xs text-gray-500">{student.suid}</div>
                  </div>
                  <Plus size={18} className="text-gray-400 group-hover:text-green-600" />
                </button>
              ))}
            </div>
          )}

          {!loadingStudents && classStudents.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <AlertCircle className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <div className="font-medium">No students found in this class</div>
            </div>
          )}
        </div>
      )}

      {/* Remarks List */}
      <div className="space-y-3">
        {filteredRemarks.map(remark => {
          const categoryColor = getCategoryColor(remark.category);
          const severityColor = getSeverityColor(remark.severity);
          
          return (
            <div key={remark.id} className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="font-semibold text-gray-900">{remark.student_name}</div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium bg-${categoryColor}-100 text-${categoryColor}-700`}>
                      {remark.category}
                    </span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium bg-${severityColor}-100 text-${severityColor}-700`}>
                      {remark.severity}
                    </span>
                    {remark.visible_to_parent ? (
                      <span className="flex items-center gap-1 text-xs text-green-600">
                        <Eye size={14} />
                        Parent visible
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-gray-500">
                        <EyeOff size={14} />
                        Internal
                      </span>
                    )}
                  </div>
                  
                  <div className="text-gray-900 font-medium mb-1">{remark.context}</div>
                  {remark.details && (
                    <div className="text-sm text-gray-600">{remark.details}</div>
                  )}
                  
                  <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                    <span>By: {remark.teacher_name || remark.created_by || 'Teacher'}</span>
                    <span className="flex items-center gap-1">
                      <Clock size={12} />
                      {new Date(remark.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Remark Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Add Student Remark</h2>
            
            <div className="space-y-4">
              {/* Student Search */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Student</label>
                <input
                  type="text"
                  placeholder="Search student by name or SUID..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  onChange={(e) => {
                    // TODO: Search students
                    if (e.target.value) {
                      setSelectedStudent({
                        id: 'student-1',
                        suid: 'STU001',
                        name: e.target.value,
                        grade: '9',
                        section: 'B'
                      });
                    }
                  }}
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                <div className="grid grid-cols-4 gap-2">
                  {CATEGORIES.map(cat => {
                    const Icon = cat.icon;
                    return (
                      <button
                        key={cat.value}
                        onClick={() => setNewCategory(cat.value)}
                        className={`p-3 rounded-lg border-2 transition-all ${
                          newCategory === cat.value
                            ? `border-${cat.color}-500 bg-${cat.color}-50`
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <Icon className={`h-6 w-6 mx-auto mb-1 ${newCategory === cat.value ? `text-${cat.color}-600` : 'text-gray-400'}`} />
                        <div className="text-xs font-medium text-gray-700">{cat.label}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Quick Context */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Quick Context</label>
                <div className="grid grid-cols-2 gap-2">
                  {QUICK_CONTEXTS[newCategory as keyof typeof QUICK_CONTEXTS].map(context => (
                    <button
                      key={context}
                      onClick={() => setNewContext(context)}
                      className={`px-3 py-2 rounded-lg border text-sm text-left transition-all ${
                        newContext === context
                          ? 'border-green-500 bg-green-50 text-green-700'
                          : 'border-gray-200 hover:border-gray-300 text-gray-700'
                      }`}
                    >
                      {context}
                    </button>
                  ))}
                </div>
              </div>

              {/* Additional Details (Optional) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Additional Details (Optional)</label>
                <textarea
                  value={newDetails}
                  onChange={(e) => setNewDetails(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  placeholder="Add any additional context..."
                />
              </div>

              {/* Parent Visibility */}
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="parentVisible"
                  checked={visibleToParent}
                  onChange={(e) => setVisibleToParent(e.target.checked)}
                  className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                />
                <label htmlFor="parentVisible" className="text-sm text-gray-700">
                  Make this remark visible to parent (Appreciation remarks are usually visible)
                </label>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    resetForm();
                  }}
                  className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddRemark}
                  disabled={!selectedStudent || !newContext}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300"
                >
                  Add Remark
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
