'use client';

import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Search, X, User, GraduationCap, Loader2, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface SearchResult {
  id: number;
  name: string;
  suid?: string;
  email: string;
  grade?: string;
  section?: string;
  roll_number?: string;
  employee_id?: string;
  department?: string;
  photo?: string | null;
  score: number;
  type: 'student' | 'teacher';
}

interface SearchResponse {
  query: string;
  students: SearchResult[];
  teachers: SearchResult[];
  total: number;
  message?: string;
}

interface SmartSearchProps {
  onSelectStudent?: (student: SearchResult) => void;
  onSelectTeacher?: (teacher: SearchResult) => void;
  placeholder?: string;
  autoFocus?: boolean;
  showModal?: boolean;
  onClose?: () => void;
}

export default function SmartSearch({
  onSelectStudent,
  onSelectTeacher,
  placeholder = "Search students, teachers... (handles typos!)",
  autoFocus = false,
  showModal = false,
  onClose
}: SmartSearchProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  useEffect(() => {
    // Handle click outside to close
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    // Debounced search
    if (query.length >= 2) {
      setLoading(true);
      setIsOpen(true);

      // Clear previous timeout
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      // Set new timeout
      debounceRef.current = setTimeout(() => {
        performSearch(query);
      }, 300);
    } else {
      setResults(null);
      setIsOpen(false);
      setLoading(false);
    }

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query]);

  const performSearch = async (searchQuery: string) => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await axios.get<SearchResponse>(
        `http://localhost:8000/api/v1/teachers/search/?q=${encodeURIComponent(searchQuery)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setResults(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Search failed:', error);
      setLoading(false);
      setResults(null);
    }
  };

  const handleSelectStudent = (student: SearchResult) => {
    if (onSelectStudent) {
      onSelectStudent(student);
    } else {
      // Default action: navigate to student profile
      router.push(`/teachers/student?id=${student.id}`);
    }
    clearSearch();
  };

  const handleSelectTeacher = (teacher: SearchResult) => {
    if (onSelectTeacher) {
      onSelectTeacher(teacher);
    } else {
      // Default action: navigate to teacher profile or show info
      console.log('Selected teacher:', teacher);
    }
    clearSearch();
  };

  const clearSearch = () => {
    setQuery('');
    setResults(null);
    setIsOpen(false);
    if (onClose) onClose();
  };

  const highlightMatch = (text: string, query: string) => {
    if (!query) return text;
    
    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const index = lowerText.indexOf(lowerQuery);
    
    if (index === -1) return text;
    
    return (
      <>
        {text.substring(0, index)}
        <span className="bg-yellow-200 font-semibold">
          {text.substring(index, index + query.length)}
        </span>
        {text.substring(index + query.length)}
      </>
    );
  };

  const ResultItem = ({ result }: { result: SearchResult }) => {
    const isStudent = result.type === 'student';
    const Icon = isStudent ? GraduationCap : User;
    
    return (
      <button
        onClick={() => isStudent ? handleSelectStudent(result) : handleSelectTeacher(result)}
        className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors text-left group"
      >
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
          isStudent ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'
        } group-hover:scale-110 transition-transform`}>
          {result.photo ? (
            <img src={result.photo} alt={result.name} className="w-10 h-10 rounded-full object-cover" />
          ) : (
            <Icon size={20} />
          )}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="font-medium text-gray-900">
            {highlightMatch(result.name, query)}
          </div>
          <div className="text-sm text-gray-500 flex items-center gap-2">
            {isStudent ? (
              <>
                <span>{highlightMatch(result.suid || '', query)}</span>
                {result.grade && result.section && (
                  <>
                    <span>•</span>
                    <span>Class {result.grade}-{result.section}</span>
                  </>
                )}
                {result.roll_number && (
                  <>
                    <span>•</span>
                    <span>Roll {result.roll_number}</span>
                  </>
                )}
              </>
            ) : (
              <>
                <span>{result.employee_id}</span>
                {result.department && (
                  <>
                    <span>•</span>
                    <span>{result.department}</span>
                  </>
                )}
              </>
            )}
          </div>
        </div>
        
        <div className="text-xs text-gray-400">
          {Math.round(result.score)}% match
        </div>
      </button>
    );
  };

  const content = (
    <div className="relative" ref={searchRef}>
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="w-full pl-10 pr-10 py-3 border-2 border-gray-300 rounded-xl focus:border-green-500 focus:ring-2 focus:ring-green-200 outline-none transition-all text-gray-900 placeholder-gray-400"
        />
        {query && (
          <button
            onClick={clearSearch}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X size={18} className="text-gray-400" />
          </button>
        )}
        {loading && (
          <div className="absolute right-10 top-1/2 -translate-y-1/2">
            <Loader2 className="h-5 w-5 text-green-600 animate-spin" />
          </div>
        )}
      </div>

      {/* Search Results Dropdown */}
      {isOpen && query.length >= 2 && (
        <div className="absolute z-50 w-full mt-2 bg-white rounded-xl shadow-2xl border border-gray-200 max-h-[500px] overflow-y-auto">
          {loading ? (
            <div className="p-8 text-center">
              <Loader2 className="h-8 w-8 text-green-600 animate-spin mx-auto mb-2" />
              <div className="text-gray-600">Searching...</div>
            </div>
          ) : results ? (
            <div className="p-2">
              {/* Students Section */}
              {results.students.length > 0 && (
                <div className="mb-3">
                  <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                    <GraduationCap size={14} />
                    Students ({results.students.length})
                  </div>
                  <div className="space-y-1">
                    {results.students.map((student) => (
                      <ResultItem key={`student-${student.id}`} result={student} />
                    ))}
                  </div>
                </div>
              )}

              {/* Teachers Section */}
              {results.teachers.length > 0 && (
                <div>
                  <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                    <User size={14} />
                    Teachers ({results.teachers.length})
                  </div>
                  <div className="space-y-1">
                    {results.teachers.map((teacher) => (
                      <ResultItem key={`teacher-${teacher.id}`} result={teacher} />
                    ))}
                  </div>
                </div>
              )}

              {/* No Results */}
              {results.total === 0 && (
                <div className="p-8 text-center">
                  <AlertCircle className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <div className="text-gray-600 font-medium mb-1">No results found</div>
                  <div className="text-sm text-gray-500">
                    {results.message || `Try different keywords for "${query}"`}
                  </div>
                  <div className="mt-3 text-xs text-gray-400">
                    💡 Tip: Our smart search handles typos and spelling mistakes!
                  </div>
                </div>
              )}

              {/* Search Info */}
              {results.total > 0 && (
                <div className="px-3 py-2 mt-2 border-t border-gray-100">
                  <div className="text-xs text-gray-500 text-center">
                    Found {results.total} result{results.total !== 1 ? 's' : ''} for "{query}"
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}

      {/* Helpful Hint */}
      {query.length === 1 && (
        <div className="absolute z-50 w-full mt-2 bg-blue-50 rounded-lg p-3 border border-blue-200">
          <div className="text-sm text-blue-700">
            💡 Type at least 2 characters to search
          </div>
        </div>
      )}
    </div>
  );

  // If modal mode, wrap in modal
  if (showModal) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-start justify-center pt-20 px-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-gray-900">Smart Search</h3>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>
          {content}
        </div>
      </div>
    );
  }

  return content;
}
