'use client';

import React, { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import { useSettings } from '@/lib/SettingsContext';
import {
  Users, UserCheck, AlertCircle, TrendingUp, Calendar, Star,
  ShieldAlert, Activity, StickyNote, Bell, Send, Plus, X,
  ChevronLeft, ChevronRight, Pin, Check, Trash2, Clock,
  GraduationCap, UserCog, Users2
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from 'recharts';
import {
  RoleBasedQuickStats,
  TodayAttendanceWidget,
  RecentAlertsWidget,
  FeeCollectionWidget,
  TopAchieversWidget,
  DashboardWidget,
  AlumniStatsWidget,
  TransfersWidget,
  MedicalRecordsWidget,
} from '@/components/DashboardWidgets';
import { usePermissionContext } from '@/lib/rbac-context';
import { useNotification } from '@/lib/NotificationContext';

// ============================================
// TYPES
// ============================================
interface Note {
  id: string;
  title: string;
  content: string;
  color: string;
  priority: string;
  is_pinned: boolean;
  is_completed: boolean;
  due_date: string | null;
  created_at: string;
}

interface Broadcast {
  id: string;
  title: string;
  message: string;
  audience: string;
  audience_display: string;
  priority: string;
  status: string;
  recipients_count: number;
  read_count: number;
  sent_at: string;
  created_at: string;
}

interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  type: 'exam' | 'holiday' | 'event';
  color: string;
  description?: string;
}

// ============================================
// MAIN DASHBOARD COMPONENT
// ============================================
export default function PrincipalDashboard() {
  const { settings } = useSettings();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'calendar' | 'notes' | 'notifications'>('overview');

  useEffect(() => {
    api.get('/dashboard/summary/').then(res => {
      setStats(res.data);
      setLoading(false);
    }).catch((error) => {
      console.error('Failed to fetch dashboard data:', error);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="p-8 text-gray-500">Calculating School Metrics...</div>;

  return (
    <div className="p-8 bg-gray-50/50 min-h-screen">
      {/* Tab Navigation */}
      <div className="flex gap-2 mb-6 bg-white p-1 rounded-xl shadow-sm w-fit">
        <TabButton active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} icon={<Activity size={18} />} label="Overview" />
        <TabButton active={activeTab === 'calendar'} onClick={() => setActiveTab('calendar')} icon={<Calendar size={18} />} label="Calendar" />
        <TabButton active={activeTab === 'notes'} onClick={() => setActiveTab('notes')} icon={<StickyNote size={18} />} label="Notes" />
        <TabButton active={activeTab === 'notifications'} onClick={() => setActiveTab('notifications')} icon={<Bell size={18} />} label="Notifications" />
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && <OverviewTab stats={stats} settings={settings} />}
      {activeTab === 'calendar' && <CalendarTab />}
      {activeTab === 'notes' && <NotesTab />}
      {activeTab === 'notifications' && <NotificationsTab />}
    </div>
  );
}

// ============================================
// TAB BUTTON
// ============================================
function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${active ? 'bg-blue-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-100'
        }`}
    >
      {icon}
      {label}
    </button>
  );
}

// ============================================
// OVERVIEW TAB (Role-Based Dashboard Content)
// ============================================
function OverviewTab({ stats, settings }: { stats: any; settings: any }) {
  const { hasModuleAccess, isAdmin } = usePermissionContext();

  if (!stats) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800 font-medium">Failed to load dashboard data</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Role-Based Quick Stats */}
      <RoleBasedQuickStats />

      {/* Role-Based Widget Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content Area */}
        <div className="lg:col-span-2 space-y-6">
          {/* Enrollment Trends - Admin/Students module */}
          {(isAdmin || hasModuleAccess('students')) && settings?.show_student_stats && (
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
              <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2">
                <TrendingUp size={20} className="text-blue-500" /> Enrollment Trends
              </h3>
              {stats?.monthly_enrollment && stats.monthly_enrollment.length > 0 ? (
                <div style={{ width: '100%', height: 320, minHeight: 320 }}>
                  <ResponsiveContainer width="100%" height={320}>
                    <BarChart data={stats.monthly_enrollment}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="month" axisLine={false} tickLine={false} />
                      <YAxis axisLine={false} tickLine={false} />
                      <Tooltip />
                      <Bar dataKey="students" fill="#2563eb" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-80 flex items-center justify-center bg-gray-50 rounded-lg">
                  <p className="text-gray-500">No enrollment data available</p>
                </div>
              )}
            </div>
          )}

          {/* Today's Attendance Widget */}
          {settings?.show_attendance_widget && <TodayAttendanceWidget />}
        </div>

        {/* Sidebar Widgets */}
        <div className="space-y-6">
          {/* Fee Collection Widget */}
          {settings?.show_finance_widget && <FeeCollectionWidget />}

          {/* Recent Incidents Widget */}
          <RecentAlertsWidget />

          {/* Recent Karma */}
          {(isAdmin || hasModuleAccess('discipline')) && settings?.karma_system_enabled && stats?.recent_karma?.length > 0 && (
            <DashboardWidget
              title="Recent Karma Awards"
              module="discipline"
              icon={<Star size={18} className="text-yellow-500" />}
            >
              <div className="space-y-3">
                {stats.recent_karma.map((item: any, i: number) => (
                  <div key={i} className="flex items-center gap-3 p-2 hover:bg-yellow-50 rounded-lg transition-colors">
                    <div className="w-8 h-8 rounded-full bg-yellow-100 flex items-center justify-center text-yellow-600">
                      <Star size={14} fill="currentColor" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{item.student_name}</p>
                      <p className="text-xs text-gray-500 truncate">{item.reason}</p>
                    </div>
                    <div className="text-green-600 font-bold text-sm">+{item.points}</div>
                  </div>
                ))}
              </div>
            </DashboardWidget>
          )}

          {/* Top Achievers */}
          {settings?.show_achievements_widget && <TopAchieversWidget />}

          {/* Alumni Statistics */}
          {settings?.show_alumni_stats && <AlumniStatsWidget />}

          {/* Transfers */}
          {settings?.show_transfers_widget && <TransfersWidget />}
        </div>
      </div>

      {/* Medical Records Review — full width below the grid */}
      {settings?.show_health_widget && <MedicalRecordsWidget />}
    </div>
  );
}

// ============================================
// CALENDAR TAB
// ============================================
function CalendarTab() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; date: Date } | null>(null);
  const [showAddModal, setShowAddModal] = useState<{ type: 'exam' | 'holiday' | 'event'; date: Date } | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const { showNotification } = useNotification();



  useEffect(() => {
    fetchCalendarData();
  }, [currentDate]);

  const fetchCalendarData = async () => {
    try {
      const [examsRes, holidaysRes, eventsRes] = await Promise.all([
        api.get('/academics/exams/'),
        api.get('/schools/holidays/'),
        api.get('/schools/events/')
      ]);

      const calendarEvents: CalendarEvent[] = [
        ...(examsRes.data?.results || examsRes.data || []).map((e: any) => ({
          id: e.id,
          title: e.name,
          date: e.exam_date,
          type: 'exam' as const,
          color: 'blue',
          description: `${e.subject_name || ''} - ${e.grade_name || ''}`
        })),
        ...(holidaysRes.data?.results || holidaysRes.data || []).map((h: any) => ({
          id: h.id,
          title: h.name,
          date: h.date,
          type: 'holiday' as const,
          color: 'red',
          description: h.description
        })),
        ...(eventsRes.data?.results || eventsRes.data || []).map((ev: any) => ({
          id: ev.id,
          title: ev.title,
          date: ev.event_date,
          type: 'event' as const,
          color: 'green',
          description: ev.description
        }))
      ];
      setEvents(calendarEvents);
    } catch (error) {
      console.error('Failed to fetch calendar data:', error);
    }
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay();
    return { daysInMonth, startingDay };
  };

  const { daysInMonth, startingDay } = getDaysInMonth(currentDate);

  const getEventsForDate = (day: number) => {
    const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return events.filter(e => e.date === dateStr);
  };

  const handleContextMenu = (e: React.MouseEvent, day: number) => {
    e.preventDefault();
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    setContextMenu({ x: e.clientX, y: e.clientY, date });
  };

  const handleAddEvent = (type: 'exam' | 'holiday' | 'event') => {
    if (contextMenu) {
      setShowAddModal({ type, date: contextMenu.date });
      setContextMenu(null);
    }
  };

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <Calendar className="text-blue-500" /> School Calendar
        </h2>

        <div className="flex items-center gap-4">
          <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))} className="p-2 hover:bg-gray-100 rounded-lg">
            <ChevronLeft size={20} />
          </button>
          <span className="font-semibold text-lg">{monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}</span>
          <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))} className="p-2 hover:bg-gray-100 rounded-lg">
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-6 mb-4 text-sm">
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-blue-500"></div> Exams</div>
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-red-500"></div> Holidays</div>
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-green-500"></div> Events</div>
      </div>

      <p className="text-sm text-gray-500 mb-4 italic">💡 Right-click on any date to add an exam, holiday, or event</p>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="p-3 text-center font-semibold text-gray-500 text-sm">{day}</div>
        ))}

        {Array.from({ length: startingDay }).map((_, i) => (
          <div key={`empty-${i}`} className="p-3 min-h-[100px]"></div>
        ))}

        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const dayEvents = getEventsForDate(day);
          const isToday = new Date().toDateString() === new Date(currentDate.getFullYear(), currentDate.getMonth(), day).toDateString();

          return (
            <div
              key={day}
              onContextMenu={(e) => handleContextMenu(e, day)}
              onClick={() => setSelectedDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), day))}
              className={`p-2 min-h-[100px] border rounded-lg cursor-pointer transition-all hover:bg-gray-50 ${isToday ? 'bg-blue-50 border-blue-300' : 'border-gray-100'
                } ${selectedDate?.getDate() === day && selectedDate?.getMonth() === currentDate.getMonth() ? 'ring-2 ring-blue-500' : ''}`}
            >
              <div className={`text-sm font-medium mb-1 ${isToday ? 'text-blue-600' : 'text-gray-700'}`}>{day}</div>
              <div className="space-y-1">
                {dayEvents.slice(0, 3).map(event => (
                  <div
                    key={event.id}
                    className={`text-xs px-1.5 py-0.5 rounded truncate ${event.type === 'exam' ? 'bg-blue-100 text-blue-700' :
                      event.type === 'holiday' ? 'bg-red-100 text-red-700' :
                        'bg-green-100 text-green-700'
                      }`}
                  >
                    {event.title}
                  </div>
                ))}
                {dayEvents.length > 3 && (
                  <div className="text-xs text-gray-500">+{dayEvents.length - 3} more</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Date Agenda */}
      {selectedDate && (
        <div className="mt-8 p-6 bg-slate-50 rounded-2xl border border-slate-100">
          <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Clock size={18} className="text-blue-500" /> 
            Agenda for {selectedDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </h3>
          <div className="space-y-3">
            {getEventsForDate(selectedDate.getDate()).length === 0 ? (
              <p className="text-sm text-gray-500 italic">No events scheduled for this day.</p>
            ) : (
              getEventsForDate(selectedDate.getDate()).map((event, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-white rounded-xl border border-gray-100 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full bg-${event.color}-500`}></div>
                    <div>
                      <p className="text-sm font-bold text-gray-900">{event.title}</p>
                      {event.description && <p className="text-xs text-gray-500">{event.description}</p>}
                    </div>
                  </div>
                  <span className="text-[10px] font-bold uppercase px-2 py-1 bg-gray-100 rounded text-gray-500">
                    {event.type}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <>
          <div className="fixed inset-0" onClick={() => setContextMenu(null)} />
          <div
            className="fixed bg-white rounded-lg shadow-xl border border-gray-200 py-2 z-50"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <button onClick={() => handleAddEvent('exam')} className="w-full px-4 py-2 text-left hover:bg-blue-50 flex items-center gap-2 text-sm">
              <GraduationCap size={16} className="text-blue-500" /> Add Exam
            </button>
            <button onClick={() => handleAddEvent('holiday')} className="w-full px-4 py-2 text-left hover:bg-red-50 flex items-center gap-2 text-sm">
              <Calendar size={16} className="text-red-500" /> Add Holiday
            </button>
            <button onClick={() => handleAddEvent('event')} className="w-full px-4 py-2 text-left hover:bg-green-50 flex items-center gap-2 text-sm">
              <Star size={16} className="text-green-500" /> Add Event
            </button>
          </div>
        </>
      )}

      {/* Add Event Modal */}
      {showAddModal && (
        <AddCalendarEventModal
          type={showAddModal.type}
          date={showAddModal.date}
          onClose={() => setShowAddModal(null)}
          onSuccess={() => { setShowAddModal(null); fetchCalendarData(); }}
          showNotification={showNotification}
        />
      )}
    </div>
  );
}

// ============================================
// ADD CALENDAR EVENT MODAL
// ============================================
function AddCalendarEventModal({ type, date, onClose, onSuccess, showNotification }: { type: 'exam' | 'holiday' | 'event'; date: Date; onClose: () => void; onSuccess: () => void; showNotification: (msg: string, type: 'success' | 'error') => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim()) return;
    setLoading(true);

    const dateStr = date.toISOString().split('T')[0];

    try {
      if (type === 'holiday') {
        await api.post('/schools/holidays/', { name: title, date: dateStr, description });
      } else if (type === 'event') {
        await api.post('/schools/events/', { title, event_date: dateStr, event_type: 'OTHER', description });
      } else if (type === 'exam') {
        // For exams, we need more fields - redirect to exam management
        showNotification('Please use the Exams Management page to create exams.', 'error');
        onClose();
        return;
      }
      showNotification(`${type} created successfully!`, 'success');
      onSuccess();
    } catch (error) {
      console.error('Failed to create:', error);
      showNotification('Failed to create. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const typeConfig = {
    exam: { title: 'Add Exam', color: 'blue', icon: <GraduationCap className="text-blue-500" /> },
    holiday: { title: 'Add Holiday', color: 'red', icon: <Calendar className="text-red-500" /> },
    event: { title: 'Add Event', color: 'green', icon: <Star className="text-green-500" /> }
  };

  const config = typeConfig[type];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold flex items-center gap-2">
            {config.icon}
            {config.title}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full">
            <X size={20} />
          </button>
        </div>

        <p className="text-sm text-gray-500 mb-4">Date: {date.toLocaleDateString()}</p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              placeholder={`Enter ${type} title`}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              rows={3}
              placeholder="Optional description"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !title.trim()}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// NOTES TAB
// ============================================
function NotesTab() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [showAddNote, setShowAddNote] = useState(false);
  const [loading, setLoading] = useState(true);
  const { showNotification } = useNotification();


  useEffect(() => {
    fetchNotes();
  }, []);

  const fetchNotes = async () => {
    try {
      const res = await api.get('/schools/notes/');
      setNotes(res.data?.results || res.data || []);
    } catch (error) {
      console.error('Failed to fetch notes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePin = async (noteId: string) => {
    try {
      await api.post(`/schools/notes/${noteId}/toggle_pin/`);
      fetchNotes();
    } catch (error) {
      console.error('Failed to toggle pin:', error);
    }
  };

  const handleToggleComplete = async (noteId: string) => {
    try {
      await api.post(`/schools/notes/${noteId}/toggle_complete/`);
      fetchNotes();
    } catch (error) {
      console.error('Failed to toggle complete:', error);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!confirm('Delete this note?')) return;
    try {
      await api.delete(`/schools/notes/${noteId}/`);
      showNotification('Note deleted successfully', 'success');
      fetchNotes();
    } catch (error) {
      console.error('Failed to delete note:', error);
      showNotification('Failed to delete note', 'error');
    }
  };

  const colorClasses: Record<string, string> = {
    yellow: 'bg-yellow-100 border-yellow-300',
    blue: 'bg-blue-100 border-blue-300',
    green: 'bg-green-100 border-green-300',
    pink: 'bg-pink-100 border-pink-300',
    purple: 'bg-purple-100 border-purple-300',
    orange: 'bg-orange-100 border-orange-300',
  };

  // Sort notes: pinned first, then by created date
  const sortedNotes = [...notes].sort((a, b) => {
    if (a.is_pinned && !b.is_pinned) return -1;
    if (!a.is_pinned && b.is_pinned) return 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <StickyNote className="text-yellow-500" /> My Notes
        </h2>

        <button
          onClick={() => setShowAddNote(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus size={18} /> Add Note
        </button>
      </div>

      {loading ? (
        <p className="text-gray-500">Loading notes...</p>
      ) : sortedNotes.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <StickyNote size={48} className="mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500">No notes yet. Click "Add Note" to create one.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {sortedNotes.map(note => (
            <div
              key={note.id}
              className={`p-4 rounded-xl border-2 shadow-sm ${colorClasses[note.color] || colorClasses.yellow} ${note.is_completed ? 'opacity-60' : ''}`}
            >
              <div className="flex items-start justify-between mb-2">
                <h4 className={`font-semibold flex items-center gap-1 ${note.is_completed ? 'line-through text-gray-500' : 'text-gray-800'}`}>
                  {note.is_pinned && <Pin size={14} className="text-blue-600" />}
                  {note.title}
                </h4>
                <div className="flex gap-1">
                  <button onClick={() => handleTogglePin(note.id)} className="p-1 hover:bg-white/50 rounded" title="Toggle Pin">
                    <Pin size={16} className={note.is_pinned ? 'text-blue-600 fill-blue-600' : 'text-gray-400'} />
                  </button>
                  <button onClick={() => handleToggleComplete(note.id)} className="p-1 hover:bg-white/50 rounded" title="Toggle Complete">
                    <Check size={16} className={note.is_completed ? 'text-green-600' : 'text-gray-400'} />
                  </button>
                  <button onClick={() => handleDeleteNote(note.id)} className="p-1 hover:bg-white/50 rounded" title="Delete">
                    <Trash2 size={16} className="text-red-400 hover:text-red-600" />
                  </button>
                </div>
              </div>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{note.content}</p>
              {note.due_date && (
                <p className="mt-2 text-xs text-gray-500 flex items-center gap-1">
                  <Clock size={12} /> Due: {new Date(note.due_date).toLocaleDateString()}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add Note Modal */}
      {showAddNote && (
        <AddNoteModal onClose={() => setShowAddNote(false)} onSuccess={() => { setShowAddNote(false); fetchNotes(); }} showNotification={showNotification} />
      )}
    </div>
  );
}

// ============================================
// ADD NOTE MODAL
// ============================================
function AddNoteModal({ onClose, onSuccess, showNotification }: { onClose: () => void; onSuccess: () => void; showNotification: (msg: string, type: 'success' | 'error') => void }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [color, setColor] = useState('yellow');
  const [priority, setPriority] = useState('MEDIUM');
  const [dueDate, setDueDate] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim() || !content.trim()) return;
    setLoading(true);

    try {
      await api.post('/schools/notes/', {
        title,
        content,
        color,
        priority,
        due_date: dueDate || null
      });
      showNotification('Note created successfully', 'success');
      onSuccess();
    } catch (error) {
      console.error('Failed to create note:', error);
      showNotification('Failed to create note. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const colors = [
    { name: 'yellow', class: 'bg-yellow-400' },
    { name: 'blue', class: 'bg-blue-400' },
    { name: 'green', class: 'bg-green-400' },
    { name: 'pink', class: 'bg-pink-400' },
    { name: 'purple', class: 'bg-purple-400' },
    { name: 'orange', class: 'bg-orange-400' },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <StickyNote className="text-yellow-500" /> Add New Note
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              placeholder="Note title"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Content</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              rows={4}
              placeholder="Write your note..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Color</label>
            <div className="flex gap-2">
              {colors.map(c => (
                <button
                  key={c.name}
                  onClick={() => setColor(c.name)}
                  className={`w-8 h-8 rounded-full ${c.class} ${color === c.name ? 'ring-2 ring-offset-2 ring-blue-500' : ''}`}
                />
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Due Date (optional)</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={loading || !title.trim() || !content.trim()}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Create Note'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// NOTIFICATIONS TAB
// ============================================
function NotificationsTab() {
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [showSendModal, setShowSendModal] = useState(false);
  const [defaultAudience, setDefaultAudience] = useState('BOTH');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBroadcasts();
  }, []);

  const fetchBroadcasts = async () => {
    try {
      const res = await api.get('/schools/broadcasts/');
      setBroadcasts(res.data?.results || res.data || []);
    } catch (error) {
      console.error('Failed to fetch broadcasts:', error);
    } finally {
      setLoading(false);
    }
  };

  const openSendModal = (audience: string) => {
    setDefaultAudience(audience);
    setShowSendModal(true);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <Bell className="text-purple-500" /> Push Notifications
        </h2>
        <button
          onClick={() => openSendModal('BOTH')}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
        >
          <Send size={18} /> Send Notification
        </button>
      </div>

      {/* Quick Send Buttons */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <button
          onClick={() => openSendModal('TEACHERS')}
          className="p-6 bg-blue-50 border-2 border-blue-200 rounded-xl text-left hover:bg-blue-100 transition-colors"
        >
          <UserCog size={24} className="text-blue-600 mb-3" />
          <h4 className="font-semibold text-gray-900">Notify Teachers</h4>
          <p className="text-sm text-gray-600">Send notification to all teachers</p>
        </button>
        <button
          onClick={() => openSendModal('STUDENTS')}
          className="p-6 bg-green-50 border-2 border-green-200 rounded-xl text-left hover:bg-green-100 transition-colors"
        >
          <GraduationCap size={24} className="text-green-600 mb-3" />
          <h4 className="font-semibold text-gray-900">Notify Students</h4>
          <p className="text-sm text-gray-600">Send notification to all students</p>
        </button>
        <button
          onClick={() => openSendModal('BOTH')}
          className="p-6 bg-purple-50 border-2 border-purple-200 rounded-xl text-left hover:bg-purple-100 transition-colors"
        >
          <Users2 size={24} className="text-purple-600 mb-3" />
          <h4 className="font-semibold text-gray-900">Notify Everyone</h4>
          <p className="text-sm text-gray-600">Send to teachers & students</p>
        </button>
      </div>

      {/* Recent Broadcasts */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
        <div className="p-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800">Recent Notifications</h3>
        </div>
        {loading ? (
          <p className="p-4 text-gray-500">Loading...</p>
        ) : broadcasts.length === 0 ? (
          <div className="p-12 text-center">
            <Bell size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500">No notifications sent yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {broadcasts.map(broadcast => (
              <div key={broadcast.id} className="p-4 hover:bg-gray-50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">{broadcast.title}</h4>
                    <p className="text-sm text-gray-600 mt-1">{broadcast.message}</p>
                    <div className="flex gap-4 mt-2 text-xs text-gray-500">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${broadcast.audience === 'TEACHERS' ? 'bg-blue-100 text-blue-700' :
                        broadcast.audience === 'STUDENTS' ? 'bg-green-100 text-green-700' :
                          'bg-purple-100 text-purple-700'
                        }`}>
                        <Users size={12} /> {broadcast.audience_display || broadcast.audience}
                      </span>
                      <span>{broadcast.recipients_count || 0} recipients</span>
                      <span>{broadcast.read_count || 0} read</span>
                    </div>
                  </div>
                  <div className="text-right ml-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${broadcast.status === 'SENT' ? 'bg-green-100 text-green-700' :
                      broadcast.status === 'SCHEDULED' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                      {broadcast.status}
                    </span>
                    <p className="text-xs text-gray-500 mt-1">
                      {broadcast.sent_at ? new Date(broadcast.sent_at).toLocaleString() : new Date(broadcast.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Send Modal */}
      {showSendModal && (
        <SendNotificationModal
          defaultAudience={defaultAudience}
          onClose={() => setShowSendModal(false)}
          onSuccess={() => { setShowSendModal(false); fetchBroadcasts(); }}
        />
      )}
    </div>
  );
}

// ============================================
// SEND NOTIFICATION MODAL
// ============================================
function SendNotificationModal({ defaultAudience, onClose, onSuccess }: { defaultAudience: string; onClose: () => void; onSuccess: () => void }) {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [audience, setAudience] = useState(defaultAudience);
  const [priority, setPriority] = useState('NORMAL');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim() || !message.trim()) return;
    setLoading(true);

    try {
      await api.post('/schools/broadcasts/send/', {
        title,
        message,
        audience,
        priority
      });
      onSuccess();
    } catch (error) {
      console.error('Failed to send notification:', error);
      alert('Failed to send notification. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-6 w-full max-w-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Send size={20} className="text-purple-500" /> Send Notification
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Audience</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 'TEACHERS', label: 'Teachers', icon: <UserCog size={16} />, color: 'blue' },
                { value: 'STUDENTS', label: 'Students', icon: <GraduationCap size={16} />, color: 'green' },
                { value: 'BOTH', label: 'Both', icon: <Users2 size={16} />, color: 'purple' }
              ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setAudience(opt.value)}
                  className={`p-3 rounded-lg border-2 flex items-center justify-center gap-2 transition-all ${audience === opt.value
                    ? `border-${opt.color}-500 bg-${opt.color}-50 text-${opt.color}-700`
                    : 'border-gray-200 hover:border-gray-300'
                    }`}
                >
                  {opt.icon} {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
              placeholder="Notification title"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
              rows={4}
              placeholder="Write your message here..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
            >
              <option value="LOW">Low - Informational</option>
              <option value="NORMAL">Normal</option>
              <option value="HIGH">High - Important</option>
              <option value="URGENT">Urgent - Immediate Attention</option>
            </select>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !title.trim() || !message.trim()}
            className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? 'Sending...' : <><Send size={16} /> Send Now</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// STAT CARD
// ============================================
function StatCard({ title, value, icon, trend }: any) {
  return (
    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all">
      <div className="flex justify-between items-start mb-4">
        <div className="p-2 bg-gray-50 rounded-lg">{icon}</div>
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{trend}</span>
      </div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <div className="text-sm text-gray-500 mt-1">{title}</div>
    </div>
  );
}