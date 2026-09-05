'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { Plus, Loader2, Trophy, Award, Calendar, ChevronDown, ChevronUp, Search, Sparkles, GraduationCap, Music, Users, Target, Heart, BookOpen, Star } from 'lucide-react';
import Modal from '@/components/Modal';
import { useSettings } from '@/lib/SettingsContext';
import { usePermissionContext } from '@/lib/rbac-context';

// Category icons and colors
const categoryConfig: Record<string, { icon: any; gradient: string; bg: string; border: string; emoji: string }> = {
  ACADEMIC: { icon: BookOpen, gradient: 'from-blue-500 to-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', emoji: '📚' },
  SPORTS: { icon: Target, gradient: 'from-green-500 to-emerald-600', bg: 'bg-green-50', border: 'border-green-200', emoji: '⚽' },
  CULTURAL: { icon: Music, gradient: 'from-purple-500 to-violet-600', bg: 'bg-purple-50', border: 'border-purple-200', emoji: '🎭' },
  OLYMPIAD: { icon: GraduationCap, gradient: 'from-amber-500 to-orange-600', bg: 'bg-amber-50', border: 'border-amber-200', emoji: '🏅' },
  LEADERSHIP: { icon: Users, gradient: 'from-orange-500 to-red-500', bg: 'bg-orange-50', border: 'border-orange-200', emoji: '👑' },
  ATTENDANCE: { icon: Calendar, gradient: 'from-teal-500 to-cyan-600', bg: 'bg-teal-50', border: 'border-teal-200', emoji: '✅' },
  DISCIPLINE: { icon: Star, gradient: 'from-indigo-500 to-blue-600', bg: 'bg-indigo-50', border: 'border-indigo-200', emoji: '🌟' },
  CREATIVITY: { icon: Sparkles, gradient: 'from-pink-500 to-rose-600', bg: 'bg-pink-50', border: 'border-pink-200', emoji: '🎨' },
  COMMUNITY: { icon: Heart, gradient: 'from-rose-500 to-pink-600', bg: 'bg-rose-50', border: 'border-rose-200', emoji: '❤️' },
  OTHER: { icon: Award, gradient: 'from-gray-500 to-slate-600', bg: 'bg-gray-50', border: 'border-gray-200', emoji: '⭐' },
};

const levelBadges: Record<string, { color: string; label: string }> = {
  CLASS: { color: 'bg-gray-100 text-gray-700', label: 'Class' },
  SCHOOL: { color: 'bg-blue-100 text-blue-700', label: 'School' },
  INTER_SCHOOL: { color: 'bg-green-100 text-green-700', label: 'Inter-School' },
  DISTRICT: { color: 'bg-yellow-100 text-yellow-700', label: 'District' },
  STATE: { color: 'bg-orange-100 text-orange-700', label: 'State' },
  NATIONAL: { color: 'bg-red-100 text-red-700', label: 'National' },
  INTERNATIONAL: { color: 'bg-purple-100 text-purple-700', label: 'International' },
};

export default function AchievementsPage() {
  const { hasPermission, isAdmin } = usePermissionContext();
  const { formatAcademicYear, settings } = useSettings();
  const currentAcademicYear = settings?.current_academic_year || '';
  const availableYears = settings?.available_academic_years || [];
  const [awards, setAwards] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterLevel, setFilterLevel] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    student: '',
    title: '',
    description: '',
    category: 'ACADEMIC',
    level: 'SCHOOL',
    award_type: 'CERTIFICATE',
    event_name: '',
    event_date: new Date().toISOString().split('T')[0],
    position: '',
    awarded_by: '',
    academic_year: currentAcademicYear,
  });

  useEffect(() => {
    fetchData();
  }, [filterCategory, filterLevel, filterYear]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Build query params
      const params = new URLSearchParams();
      if (filterCategory) params.append('category', filterCategory);
      if (filterLevel) params.append('level', filterLevel);
      if (filterYear) params.append('academic_year', filterYear);
      
      const studentParams: any = { status: 'ACTIVE' };
      if (filterYear) studentParams.academic_year = filterYear;

      const [awardsRes, statsRes, studentsRes] = await Promise.all([
        api.get(`/achievements/yearly-awards/?${params.toString()}`),
        api.get('/achievements/yearly-awards/stats/'),
        api.get('/students/', { params: studentParams })
      ]);
      
      const awardsList = awardsRes.data?.results || awardsRes.data || [];
      setAwards(Array.isArray(awardsList) ? awardsList : []);
      setStats(statsRes.data);
      
      const studentsList = studentsRes.data?.results || studentsRes.data || [];
      setStudents(Array.isArray(studentsList) ? studentsList : []);
    } catch (error) {
      console.error('Failed to load data', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (data: Record<string, string | number | boolean>) => {
    setSubmitting(true);
    setError('');
    try {
      await api.post('/achievements/yearly-awards/', {
        student: data.student,
        title: data.title,
        description: data.description,
        category: data.category,
        level: data.level,
        award_type: data.award_type,
        event_name: data.event_name,
        event_date: data.event_date,
        position: data.position,
        awarded_by: data.awarded_by,
        academic_year: data.academic_year,
      });
      setShowModal(false);
      setFormData({
        student: '',
        title: '',
        description: '',
        category: 'ACADEMIC',
        level: 'SCHOOL',
        award_type: 'CERTIFICATE',
        event_name: '',
        event_date: new Date().toISOString().split('T')[0],
        position: '',
        awarded_by: '',
        academic_year: currentAcademicYear,
      });
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to add achievement');
    } finally {
      setSubmitting(false);
    }
  };

  const fields = [
    {
      name: 'student',
      label: 'Student',
      type: 'select' as const,
      required: true,
      options: students.map(s => ({
        value: s.id.toString(),
        label: `${s.full_name || s.first_name + ' ' + s.last_name} (${s.suid})`
      })),
    },
    {
      name: 'academic_year',
      label: 'Academic Year',
      type: 'select' as const,
      required: true,
      options: availableYears.map(y => ({ value: y, label: y })),
    },
    {
      name: 'category',
      label: 'Category',
      type: 'select' as const,
      required: true,
      options: Object.entries(categoryConfig).map(([key, val]) => ({
        value: key,
        label: `${val.emoji} ${key.replace('_', ' ')}`
      })),
    },
    {
      name: 'level',
      label: 'Level',
      type: 'select' as const,
      required: true,
      options: Object.entries(levelBadges).map(([key, val]) => ({
        value: key,
        label: val.label
      })),
    },
    {
      name: 'award_type',
      label: 'Award Type',
      type: 'select' as const,
      required: true,
      options: [
        { value: 'CERTIFICATE', label: '📜 Certificate' },
        { value: 'AWARD', label: '🏆 Award' },
        { value: 'MEDAL', label: '🏅 Medal' },
        { value: 'TROPHY', label: '🏆 Trophy' },
        { value: 'CASH_PRIZE', label: '💰 Cash Prize' },
        { value: 'SCHOLARSHIP', label: '🎓 Scholarship' },
        { value: 'APPRECIATION', label: '👏 Appreciation' },
        { value: 'OTHER', label: '⭐ Other' },
      ],
    },
    {
      name: 'title',
      label: 'Award Title',
      type: 'text' as const,
      required: true,
      placeholder: 'e.g., 1st Place - Science Exhibition',
    },
    {
      name: 'event_name',
      label: 'Event Name',
      type: 'text' as const,
      placeholder: 'e.g., Annual Science Fair 2024',
    },
    {
      name: 'position',
      label: 'Position/Rank',
      type: 'text' as const,
      placeholder: 'e.g., 1st, Gold, Winner',
    },
    {
      name: 'event_date',
      label: 'Event Date',
      type: 'text' as const,
      required: true,
      placeholder: 'YYYY-MM-DD',
    },
    {
      name: 'awarded_by',
      label: 'Awarded By',
      type: 'text' as const,
      placeholder: 'e.g., Principal, District Collector',
    },
    {
      name: 'description',
      label: 'Description',
      type: 'textarea' as const,
      placeholder: 'Details about the achievement...',
    },
  ];

  // Filter awards by search
  const filteredAwards = awards.filter(award => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      award.title?.toLowerCase().includes(query) ||
      award.student_name?.toLowerCase().includes(query) ||
      award.student_suid?.toLowerCase().includes(query) ||
      award.event_name?.toLowerCase().includes(query)
    );
  });

  if (loading) {
    return (
      <div className="flex justify-center items-center p-12">
        <Loader2 className="animate-spin text-amber-600" size={40} />
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-full overflow-hidden">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Trophy className="text-amber-500" size={28} /> Achievements & Awards
          </h1>
          <p className="text-gray-500 text-sm mt-1">Celebrate student success and milestones</p>
        </div>
        {(isAdmin || hasPermission('achievements.create_achievement')) && (
          <button
            onClick={() => setShowModal(true)}
            className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg font-medium transition flex items-center gap-2 text-sm"
          >
            <Plus size={18} /> Add New
          </button>
        )}
      </div>

      {/* Stats Grid - Responsive */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        {/* Total Card First */}
        <div className="bg-gradient-to-br from-slate-700 to-slate-900 p-3 rounded-xl text-white">
          <div className="text-2xl font-bold">{stats?.total || 0}</div>
          <div className="text-xs text-white/70">Total</div>
        </div>
        {stats && Object.entries(stats.by_category || {})
          .filter(([_, value]: [string, any]) => value.count > 0)
          .slice(0, 5)
          .map(([key, value]: [string, any]) => {
            const config = categoryConfig[key] || categoryConfig.OTHER;
            return (
              <div 
                key={key}
                onClick={() => setFilterCategory(filterCategory === key ? '' : key)}
                className={`cursor-pointer transition-all ${
                  filterCategory === key ? 'ring-2 ring-amber-500 scale-[1.02]' : ''
                }`}
              >
                <div className={`bg-gradient-to-br ${config.gradient} p-3 rounded-xl text-white`}>
                  <div className="text-2xl font-bold">{value.count}</div>
                  <div className="text-xs text-white/70 truncate">{config.emoji} {key.slice(0, 6)}</div>
                </div>
              </div>
            );
          })}
      </div>

      {/* Info Banner - Compact */}
      <div className="bg-amber-50 border border-amber-200 px-4 py-2 rounded-lg">
        <p className="text-xs text-amber-700">
          💡 All achievements are permanently recorded and accessible to students and parents forever.
        </p>
      </div>

      {/* Filters & Search - Compact */}
      <div className="bg-white rounded-xl border border-gray-200 p-3">
        <div className="flex flex-wrap gap-2">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Search student, title, event..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-200 focus:border-amber-500 focus:ring-1 focus:ring-amber-200 transition"
            />
          </div>
          
          {/* Level Filter */}
          <select
            value={filterLevel}
            onChange={(e) => setFilterLevel(e.target.value)}
            className="px-3 py-2 text-sm rounded-lg border border-gray-200 focus:border-amber-500 focus:ring-1 focus:ring-amber-200 transition bg-white"
          >
            <option value="">All Levels</option>
            {Object.entries(levelBadges).map(([key, val]) => (
              <option key={key} value={key}>{val.label}</option>
            ))}
          </select>
          
          {/* Year Filter */}
          <select
            value={filterYear}
            onChange={(e) => setFilterYear(e.target.value)}
            className="px-3 py-2 text-sm rounded-lg border border-gray-200 focus:border-amber-500 focus:ring-1 focus:ring-amber-200 transition bg-white"
          >
            <option value="">All Years</option>
            {stats?.by_year?.map((y: any) => (
              <option key={y.academic_year} value={y.academic_year}>
                {formatAcademicYear(y.academic_year)} ({y.count})
              </option>
            ))}
          </select>
          
          {/* Clear Filters */}
          {(filterCategory || filterLevel || filterYear || searchQuery) && (
            <button
              onClick={() => {
                setFilterCategory('');
                setFilterLevel('');
                setFilterYear('');
                setSearchQuery('');
              }}
              className="px-3 py-2 text-sm text-amber-600 hover:bg-amber-50 rounded-lg transition font-medium"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Achievements List */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <Sparkles className="text-amber-500" size={18} />
            Recent Achievements
          </h2>
          <span className="text-xs text-gray-500">
            {filteredAwards.length} awards
          </span>
        </div>
        
        {filteredAwards.length === 0 ? (
          <div className="text-center py-12 px-4">
            <div className="w-16 h-16 mx-auto mb-3 bg-amber-100 rounded-full flex items-center justify-center">
              <Trophy size={32} className="text-amber-400" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-1">No achievements found</h3>
            <p className="text-sm text-gray-500">
              {searchQuery || filterCategory || filterLevel || filterYear 
                ? 'Try adjusting your filters.'
                : 'Add your first achievement!'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 max-h-[500px] overflow-y-auto">
            {filteredAwards.map((award) => {
              const config = categoryConfig[award.category] || categoryConfig.OTHER;
              const level = levelBadges[award.level] || levelBadges.SCHOOL;
              const isExpanded = expandedId === award.id;
              
              return (
                <div 
                  key={award.id}
                  className="p-3 hover:bg-gray-50 transition cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : award.id)}
                >
                  <div className="flex items-start gap-3">
                    {/* Category Icon */}
                    <div className={`flex-none w-10 h-10 rounded-xl bg-gradient-to-br ${config.gradient} flex items-center justify-center text-white text-lg`}>
                      {config.emoji}
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${level.color}`}>
                          {level.label}
                        </span>
                        {award.position && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
                            {award.position}
                          </span>
                        )}
                        <span className="text-[10px] text-gray-400">
                          {formatAcademicYear(award.academic_year)}
                        </span>
                      </div>
                      
                      <h3 className="font-semibold text-gray-900 text-sm line-clamp-1">
                        {award.title}
                      </h3>
                      
                      <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                        <span className="font-medium text-gray-700">{award.student_name}</span>
                        <span>•</span>
                        <span>{award.student_suid}</span>
                        {award.grade_name && (
                          <>
                            <span>•</span>
                            <span>{award.grade_name}-{award.section_name}</span>
                          </>
                        )}
                      </div>
                      
                      {/* Expanded Content */}
                      {isExpanded && (
                        <div className="mt-3 pt-3 border-t border-gray-100 space-y-2 text-xs">
                          {award.event_name && (
                            <div className="flex items-center gap-2 text-gray-600">
                              <Calendar size={14} className="text-gray-400" />
                              {award.event_name}
                              {award.event_date && ` • ${new Date(award.event_date).toLocaleDateString()}`}
                            </div>
                          )}
                          {award.awarded_by && (
                            <div className="flex items-center gap-2 text-gray-600">
                              <Award size={14} className="text-gray-400" />
                              Awarded by: <strong>{award.awarded_by}</strong>
                            </div>
                          )}
                          {award.description && (
                            <p className="text-gray-600 bg-gray-50 p-2 rounded-lg">
                              {award.description}
                            </p>
                          )}
                          {award.cash_prize_amount && (
                            <div className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">
                              💰 {award.cash_prize_currency} {award.cash_prize_amount}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    
                    {/* Expand Icon */}
                    <div className="flex-none text-gray-300">
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Add Achievement"
        fields={fields}
        formData={formData}
        onFormChange={(field, value) => setFormData({ ...formData, [field]: value })}
        onSubmit={handleSubmit}
        loading={submitting}
        error={error}
        submitButtonText="Add Achievement"
        color="orange"
      />
    </div>
  );
}
