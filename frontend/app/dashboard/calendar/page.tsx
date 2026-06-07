'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { 
  Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, X, Loader2, 
  PartyPopper, Clock, Trash2, GraduationCap, Sun, Flag, CalendarDays, MapPin
} from 'lucide-react';

interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  type: 'exam' | 'holiday' | 'event';
  description?: string;
  color?: string;
  location?: string;
  start_time?: string;
  end_time?: string;
}

const formatDateStr = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseLocalDate = (dateStr: string) => {
  if (!dateStr) return new Date();
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
};

export default function SchoolCalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>(formatDateStr(new Date()));
  const [showAddModal, setShowAddModal] = useState(false);
  const [addType, setAddType] = useState<'holiday' | 'event'>('holiday');
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    date: '',
    description: '',
    location: '',
    start_time: '',
    end_time: '',
    is_all_day: true,
  });

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const [examsRes, holidaysRes, eventsRes] = await Promise.all([
        api.get('/academics/exams/'),
        api.get('/schools/holidays/').catch(() => ({ data: [] })),
        api.get('/schools/events/').catch(() => ({ data: [] }))
      ]);

      const exams = Array.isArray(examsRes.data) ? examsRes.data : examsRes.data.results || [];
      const holidays = Array.isArray(holidaysRes.data) ? holidaysRes.data : holidaysRes.data.results || [];
      const schoolEvents = Array.isArray(eventsRes.data) ? eventsRes.data : eventsRes.data.results || [];

      const allEvents: CalendarEvent[] = [
        ...exams.map((e: any) => ({
          id: `exam-${e.id}`,
          title: e.name,
          date: e.exam_date,
          type: 'exam' as const,
          description: `${e.subject_name || ''} - ${e.section_name || ''} (${e.grade_name || ''})`,
          color: 'indigo'
        })),
        ...holidays.map((h: any) => ({
          id: `holiday-${h.id}`,
          title: h.name,
          date: h.date,
          type: 'holiday' as const,
          description: h.description,
          color: 'rose'
        })),
        ...schoolEvents.map((e: any) => ({
          id: `event-${e.id}`,
          title: e.title,
          date: e.event_date,
          type: 'event' as const,
          description: e.description,
          location: e.location,
          start_time: e.start_time,
          end_time: e.end_time,
          color: 'emerald'
        }))
      ];

      setEvents(allEvents);
    } catch (error) {
      console.error('Failed to load calendar events', error);
    } finally {
      setLoading(false);
    }
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay();

    const days: { date: Date; isCurrentMonth: boolean }[] = [];

    for (let i = startingDay; i > 0; i--) {
      days.push({ date: new Date(year, month, 1 - i), isCurrentMonth: false });
    }

    for (let i = 1; i <= daysInMonth; i++) {
      days.push({ date: new Date(year, month, i), isCurrentMonth: true });
    }

    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({ date: new Date(year, month + 1, i), isCurrentMonth: false });
    }

    return days;
  };

  const getEventsOnDate = (dateStr: string) => events.filter(e => e.date === dateStr);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (addType === 'holiday') {
        await api.post('/schools/holidays/', {
          name: formData.title,
          date: formData.date,
          description: formData.description
        });
      } else {
        await api.post('/schools/events/', {
          title: formData.title,
          event_date: formData.date,
          description: formData.description,
          location: formData.location,
          start_time: formData.start_time || null,
          end_time: formData.end_time || null,
          is_all_day: formData.is_all_day
        });
      }
      setShowAddModal(false);
      setFormData({ title: '', date: '', description: '', location: '', start_time: '', end_time: '', is_all_day: true });
      fetchEvents();
    } catch (error) {
      console.error('Failed to create', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (event: CalendarEvent) => {
    if (!confirm(`Delete "${event.title}"?`)) return;
    try {
      const [type, id] = event.id.split('-');
      if (type === 'holiday') {
        await api.delete(`/schools/holidays/${id}/`);
      } else if (type === 'event') {
        await api.delete(`/schools/events/${id}/`);
      }
      fetchEvents();
    } catch (error) {
      console.error('Failed to delete', error);
    }
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'exam': return <GraduationCap size={14} />;
      case 'holiday': return <Sun size={14} />;
      case 'event': return <Flag size={14} />;
      default: return <CalendarIcon size={14} />;
    }
  };

  const upcomingEvents = events
    .filter(e => new Date(e.date) >= new Date())
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 5);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[600px] gap-4">
        <Loader2 className="w-12 h-12 animate-spin text-indigo-600" />
        <p className="text-slate-500 font-bold animate-pulse">Synchronizing School Calendar...</p>
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto animate-in fade-in duration-700">
      <div className="grid lg:grid-cols-4 gap-8">
        
        {/* Left Column: Calendar Main */}
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-white rounded-[32px] shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-slate-50/50 border-b border-slate-100">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2 bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm">
                  <button
                    onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
                    className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
                  >
                    <ChevronLeft size={20} className="text-slate-600" />
                  </button>
                  <button
                    onClick={() => setCurrentMonth(new Date())}
                    className="px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
                  >
                    Today
                  </button>
                  <button
                    onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
                    className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
                  >
                    <ChevronRight size={20} className="text-slate-600" />
                  </button>
                </div>
                <h2 className="text-3xl font-black text-slate-900 tracking-tight">
                  {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </h2>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => { setAddType('holiday'); setFormData({ ...formData, date: selectedDate }); setShowAddModal(true); }}
                  className="flex items-center gap-2 px-5 py-3 bg-rose-50 text-rose-700 rounded-2xl font-black text-sm hover:bg-rose-100 transition shadow-sm border border-rose-100"
                >
                  <Sun size={18} /> Add Holiday
                </button>
                <button
                  onClick={() => { setAddType('event'); setFormData({ ...formData, date: selectedDate }); setShowAddModal(true); }}
                  className="flex items-center gap-2 px-5 py-3 bg-indigo-600 text-white rounded-2xl font-black text-sm hover:bg-indigo-700 transition shadow-xl shadow-indigo-100 active:scale-95"
                >
                  <Plus size={18} /> Create Event
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 border-b border-slate-100">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="py-4 text-center text-xs font-black uppercase tracking-widest text-slate-400">
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7">
              {getDaysInMonth(currentMonth).map((day, idx) => {
                const dateStr = formatDateStr(day.date);
                const dayEvents = getEventsOnDate(dateStr);
                const isToday = formatDateStr(new Date()) === dateStr;
                const isSelected = selectedDate === dateStr;

                return (
                  <div
                    key={idx}
                    onClick={() => setSelectedDate(dateStr)}
                    className={`min-h-[140px] p-3 border-r border-b border-slate-50 cursor-pointer transition-all duration-300 group ${
                      !day.isCurrentMonth ? 'bg-slate-50/30' : 'bg-white'
                    } ${isSelected ? 'ring-2 ring-inset ring-indigo-500 bg-indigo-50/10' : 'hover:bg-slate-50/50'}`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className={`text-sm font-bold w-8 h-8 flex items-center justify-center rounded-xl transition-all ${
                        isToday ? 'bg-indigo-600 text-white shadow-lg' : 
                        day.isCurrentMonth ? 'text-slate-900 group-hover:bg-slate-100' : 'text-slate-300'
                      }`}>
                        {day.date.getDate()}
                      </span>
                      {dayEvents.length > 0 && (
                        <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full"></div>
                      )}
                    </div>

                    <div className="space-y-1.5 overflow-hidden">
                      {dayEvents.slice(0, 3).map((event, i) => (
                        <div
                          key={i}
                          className={`text-[10px] px-2 py-1.5 rounded-lg font-black truncate border flex items-center gap-1.5
                            ${event.type === 'exam' ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : 
                              event.type === 'holiday' ? 'bg-rose-50 text-rose-700 border-rose-100' : 
                              'bg-emerald-50 text-emerald-700 border-emerald-100'}`}
                        >
                          {getEventIcon(event.type)}
                          <span className="truncate uppercase tracking-tighter">{event.title}</span>
                        </div>
                      ))}
                      {dayEvents.length > 3 && (
                        <div className="text-[10px] text-slate-400 font-bold px-1">
                          + {dayEvents.length - 3} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Agenda & Upcoming */}
        <div className="space-y-6">
          <div className="bg-white rounded-[32px] p-6 shadow-sm border border-slate-200">
             <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-black text-slate-900">Agenda</h3>
                <CalendarDays size={20} className="text-slate-400" />
             </div>
             
             <div className="space-y-4">
                <div className="text-center py-4 bg-slate-50 rounded-2xl border border-slate-100">
                   <p className="text-xs font-black text-slate-400 uppercase tracking-widest">
                     {parseLocalDate(selectedDate).toLocaleDateString('en-US', { weekday: 'long' })}
                   </p>
                   <p className="text-2xl font-black text-indigo-600">
                     {parseLocalDate(selectedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                   </p>
                </div>

                {getEventsOnDate(selectedDate).length === 0 ? (
                  <div className="text-center py-12">
                     <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-100">
                        <Clock size={24} className="text-slate-300" />
                     </div>
                     <p className="text-slate-400 font-bold text-sm">Nothing scheduled</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {getEventsOnDate(selectedDate).map((event, i) => (
                      <div 
                        key={i} 
                        className={`p-4 rounded-2xl border group transition-all hover:scale-[1.02] 
                          ${event.type === 'exam' ? 'bg-indigo-50/50 border-indigo-100' : 
                            event.type === 'holiday' ? 'bg-rose-50/50 border-rose-100' : 
                            'bg-emerald-50/50 border-emerald-100'}`}
                      >
                        <div className="flex justify-between items-start mb-2">
                           <div className={`p-1.5 rounded-lg ${
                              event.type === 'exam' ? 'bg-indigo-100 text-indigo-600' : 
                              event.type === 'holiday' ? 'bg-rose-100 text-rose-600' : 
                              'bg-emerald-100 text-emerald-600'
                           }`}>
                             {getEventIcon(event.type)}
                           </div>
                           <button 
                             onClick={() => handleDelete(event)}
                             className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-white rounded-lg transition-all text-slate-400 hover:text-rose-500"
                           >
                             <Trash2 size={14} />
                           </button>
                        </div>
                        <h4 className="font-black text-slate-900 text-sm mb-1">{event.title}</h4>
                        {event.description && <p className="text-xs text-slate-500 leading-relaxed">{event.description}</p>}
                        {event.location && (
                          <div className="mt-2 flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase">
                            <MapPin size={10} /> {event.location}
                          </div>
                        )}
                        {event.start_time && (
                          <div className="mt-1 flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase">
                            <Clock size={10} /> {event.start_time} - {event.end_time || 'End'}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
             </div>
          </div>

          <div className="bg-slate-900 rounded-[32px] p-6 text-white relative overflow-hidden group shadow-2xl">
            <h3 className="text-lg font-black mb-6 flex items-center gap-2">
              <PartyPopper size={20} className="text-indigo-400" /> Coming Up
            </h3>
            <div className="space-y-4">
              {upcomingEvents.map((event, i) => (
                <div key={i} className="flex gap-4 items-start relative">
                  <div className={`w-4 h-4 rounded-full mt-1.5 z-10 shrink-0 border-2 border-slate-900 ${
                    event.type === 'exam' ? 'bg-indigo-500' : event.type === 'holiday' ? 'bg-rose-500' : 'bg-emerald-500'
                  }`}></div>
                  <div>
                    <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-0.5">
                      {new Date(event.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </p>
                    <p className="text-sm font-bold text-slate-200 line-clamp-1">{event.title}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100">
            <div className={`p-8 text-white flex justify-between items-center ${
              addType === 'holiday' ? 'bg-gradient-to-br from-rose-500 to-orange-500' : 'bg-gradient-to-br from-indigo-600 to-purple-600'
            }`}>
              <div>
                <h2 className="text-2xl font-black flex items-center gap-3">
                  {addType === 'holiday' ? <Sun size={24} /> : <Flag size={24} />}
                  Add {addType === 'holiday' ? 'Holiday' : 'School Event'}
                </h2>
                <p className="text-white/80 text-xs font-bold uppercase tracking-widest mt-1">
                  Scheduled for {parseLocalDate(formData.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
              <button onClick={() => setShowAddModal(false)} className="bg-white/20 p-2 rounded-2xl hover:bg-white/30 transition-colors">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <div className="grid gap-6">
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Title / Subject *</label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-slate-900 font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all placeholder:text-slate-300"
                    placeholder={addType === 'holiday' ? "e.g. Diwali Break" : "e.g. Science Exhibition"}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Date</label>
                    <input
                      type="date"
                      required
                      value={formData.date}
                      onChange={e => setFormData({ ...formData, date: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-slate-900 font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
                    />
                  </div>
                  {addType === 'event' && (
                    <div>
                      <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Location</label>
                      <input
                        type="text"
                        value={formData.location}
                        onChange={e => setFormData({ ...formData, location: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-slate-900 font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
                        placeholder="e.g. Main Hall"
                      />
                    </div>
                  )}
                </div>

                {addType === 'event' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Start Time</label>
                      <input
                        type="time"
                        value={formData.start_time}
                        onChange={e => setFormData({ ...formData, start_time: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-slate-900 font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">End Time</label>
                      <input
                        type="time"
                        value={formData.end_time}
                        onChange={e => setFormData({ ...formData, end_time: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-slate-900 font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Description</label>
                  <textarea
                    rows={3}
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-slate-900 font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all placeholder:text-slate-300 resize-none"
                    placeholder="Brief details about this day..."
                  />
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-8 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-sm hover:bg-slate-200 transition-colors"
                >
                  Discard
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className={`flex-1 px-8 py-4 text-white rounded-2xl font-black text-sm shadow-xl transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 
                    ${addType === 'holiday' ? 'bg-rose-600 shadow-rose-100 hover:bg-rose-700' : 'bg-indigo-600 shadow-indigo-100 hover:bg-indigo-700'}`}
                >
                  {submitting ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle size={18} />}
                  Confirm {addType === 'holiday' ? 'Holiday' : 'Event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function CheckCircle({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}
