'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import axios from 'axios';
import { 
  Clock, AlertCircle, CheckCircle, BookOpen, Users, 
  ClipboardCheck, TrendingUp, Calendar, Bell, ChevronLeft,
  ChevronRight, X, Check
} from 'lucide-react';

interface ClassSession {
  id: string;
  subject: string;
  grade: string;
  section: string;
  period: number;
  start_time: string;
  end_time: string;
  attendance_marked: boolean;
  student_count: number;
}

interface Alert {
  id: string;
  type: 'health' | 'discipline' | 'admin';
  message: string;
  priority: 'high' | 'medium' | 'low';
}

interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  type: 'exam' | 'holiday' | 'event';
}

interface Notification {
  id: string;
  title: string;
  message: string;
  priority: string;
  audience_display: string;
  sent_at: string;
  is_read: boolean;
}

export default function TeacherDashboard() {
  const [loading, setLoading] = useState(true);
  const [todayClasses, setTodayClasses] = useState<ClassSession[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [stats, setStats] = useState({
    classesToday: 0,
    pendingAttendance: 0,
    studentsToday: 0,
    examsToday: 0
  });
  const [activeTab, setActiveTab] = useState<'schedule' | 'calendar' | 'notifications'>('schedule');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  useEffect(() => {
    fetchDashboardData();
    fetchNotifications();
    fetchCalendarData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const token = localStorage.getItem('access_token');
      
      const response = await axios.get(
        'http://localhost:8000/api/v1/teachers/assignments/?is_active=true',
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      const classes = response.data.map((assignment: any, index: number) => ({
        id: assignment.id.toString(),
        subject: assignment.subject || assignment.role,
        grade: assignment.grade,
        section: assignment.section,
        period: index + 1,
        start_time: `${8 + index}:30`,
        end_time: `${9 + index}:30`,
        attendance_marked: false,
        student_count: assignment.student_count || 0
      }));
      
      setTodayClasses(classes);

      setAlerts([
        {
          id: '1',
          type: 'admin',
          message: 'Monthly test marks submission deadline: Tomorrow',
          priority: 'high'
        },
        {
          id: '2',
          type: 'health',
          message: 'Student Rahul Kumar (9-A) has medical restriction',
          priority: 'medium'
        }
      ]);

      setStats({
        classesToday: classes.length || 3,
        pendingAttendance: 2,
        studentsToday: 120,
        examsToday: 0
      });
    } catch (error) {
      console.error('Failed to fetch dashboard data', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchNotifications = async () => {
    try {
      const token = localStorage.getItem('access_token');
      console.log('Fetching notifications with token:', token ? 'exists' : 'missing');
      
      const [notifRes, countRes] = await Promise.all([
        axios.get('http://localhost:8000/api/v1/schools/broadcasts/my_notifications/', {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get('http://localhost:8000/api/v1/schools/broadcasts/unread_count/', {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);
      
      console.log('Notifications response:', notifRes.data);
      console.log('Unread count response:', countRes.data);
      
      setNotifications(notifRes.data || []);
      setUnreadCount(countRes.data?.count || 0);
    } catch (error) {
      console.error('Failed to fetch notifications', error);
    }
  };

  const fetchCalendarData = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const [examsRes, holidaysRes, eventsRes] = await Promise.all([
        axios.get('http://localhost:8000/api/v1/academics/exams/', {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get('http://localhost:8000/api/v1/schools/holidays/', {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get('http://localhost:8000/api/v1/schools/events/', {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      const events: CalendarEvent[] = [
        ...(examsRes.data?.results || examsRes.data || []).map((e: any) => ({
          id: e.id,
          title: e.name,
          date: e.exam_date,
          type: 'exam' as const
        })),
        ...(holidaysRes.data?.results || holidaysRes.data || []).map((h: any) => ({
          id: h.id,
          title: h.name,
          date: h.date,
          type: 'holiday' as const
        })),
        ...(eventsRes.data?.results || eventsRes.data || []).map((ev: any) => ({
          id: ev.id,
          title: ev.title,
          date: ev.event_date,
          type: 'event' as const
        }))
      ];
      setCalendarEvents(events);
    } catch (error) {
      console.error('Failed to fetch calendar data', error);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      const token = localStorage.getItem('access_token');
      await axios.post(
        `http://localhost:8000/api/v1/schools/broadcasts/${notificationId}/mark_read/`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchNotifications();
    } catch (error) {
      console.error('Failed to mark as read', error);
    }
  };

  const getCurrentPeriod = () => {
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    return todayClasses.find(cls => {
      return currentTime >= cls.start_time && currentTime <= cls.end_time;
    });
  };

  const currentClass = getCurrentPeriod();

  // Calendar helpers
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    return { 
      daysInMonth: lastDay.getDate(), 
      startingDay: firstDay.getDay() 
    };
  };

  const getEventsForDate = (day: number) => {
    const dateStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return calendarEvents.filter(e => e.date === dateStr);
  };

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const { daysInMonth, startingDay } = getDaysInMonth(currentMonth);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Good Morning! 👋</h1>
          <p className="text-gray-600 mt-1">Here's your day at a glance</p>
        </div>
        {/* Tab Navigation */}
        <div className="flex gap-2 bg-white p-1 rounded-xl shadow-sm border">
          <button
            onClick={() => setActiveTab('schedule')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
              activeTab === 'schedule' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Clock size={18} /> Schedule
          </button>
          <button
            onClick={() => setActiveTab('calendar')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
              activeTab === 'calendar' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Calendar size={18} /> Calendar
          </button>
          <button
            onClick={() => setActiveTab('notifications')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all relative ${
              activeTab === 'notifications' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Bell size={18} /> Notifications
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Current Class Alert */}
      {currentClass && activeTab === 'schedule' && (
        <div className="bg-gradient-to-r from-green-600 to-green-700 text-white p-6 rounded-xl shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Clock size={20} />
                <span className="text-sm font-medium">ONGOING NOW</span>
              </div>
              <h2 className="text-2xl font-bold mb-1">
                {currentClass.subject} - Grade {currentClass.grade}{currentClass.section}
              </h2>
              <p className="text-green-100">
                Period {currentClass.period} • {currentClass.start_time} - {currentClass.end_time}
              </p>
            </div>
            {!currentClass.attendance_marked && (
              <Link
                href={`/teachers/attendance?class=${currentClass.id}`}
                className="bg-white text-green-700 px-6 py-3 rounded-lg font-semibold hover:bg-green-50 transition-colors"
              >
                Mark Attendance
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Quick Stats - Always visible */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <Calendar className="h-8 w-8 text-blue-600" />
          </div>
          <div className="text-3xl font-bold text-gray-900">{stats.classesToday}</div>
          <div className="text-gray-600 text-sm">Classes Today</div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <ClipboardCheck className="h-8 w-8 text-orange-600" />
          </div>
          <div className="text-3xl font-bold text-gray-900">{stats.pendingAttendance}</div>
          <div className="text-gray-600 text-sm">Pending Attendance</div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <Users className="h-8 w-8 text-purple-600" />
          </div>
          <div className="text-3xl font-bold text-gray-900">{stats.studentsToday}</div>
          <div className="text-gray-600 text-sm">Students Today</div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <Bell className="h-8 w-8 text-red-600" />
          </div>
          <div className="text-3xl font-bold text-gray-900">{unreadCount}</div>
          <div className="text-gray-600 text-sm">Unread Notifications</div>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'schedule' && (
        <>
          {/* Alerts */}
          {alerts.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-red-600" />
                Important Alerts
              </h3>
              <div className="space-y-3">
                {alerts.map(alert => (
                  <div
                    key={alert.id}
                    className={`p-4 rounded-lg border-l-4 ${
                      alert.priority === 'high' ? 'bg-red-50 border-red-600' :
                      alert.priority === 'medium' ? 'bg-yellow-50 border-yellow-600' :
                      'bg-blue-50 border-blue-600'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <AlertCircle size={18} className={
                        alert.priority === 'high' ? 'text-red-600' :
                        alert.priority === 'medium' ? 'text-yellow-600' :
                        'text-blue-600'
                      } />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">{alert.message}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Today's Schedule */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold mb-4">Today's Schedule</h3>
            <div className="space-y-3">
              {todayClasses.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No classes scheduled for today</p>
              ) : (
                todayClasses.map(cls => (
                  <div
                    key={cls.id}
                    className={`p-4 rounded-lg border ${
                      cls.id === currentClass?.id ? 'border-green-600 bg-green-50' : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${
                            cls.attendance_marked ? 'bg-green-600' : 'bg-orange-400'
                          }`} />
                          <div>
                            <div className="font-semibold text-gray-900">
                              Period {cls.period} • {cls.subject}
                            </div>
                            <div className="text-sm text-gray-600">
                              Grade {cls.grade}{cls.section} • {cls.student_count} students • {cls.start_time} - {cls.end_time}
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        {cls.attendance_marked ? (
                          <span className="flex items-center gap-1 text-green-600 text-sm font-medium">
                            <CheckCircle size={16} />
                            Marked
                          </span>
                        ) : (
                          <Link
                            href={`/teachers/attendance?class=${cls.id}`}
                            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                          >
                            Mark Attendance →
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}

      {activeTab === 'calendar' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <Calendar className="text-blue-500" /> School Calendar
            </h3>
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))} 
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <ChevronLeft size={20} />
              </button>
              <span className="font-semibold text-lg">{monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}</span>
              <button 
                onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))} 
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
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

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="p-3 text-center font-semibold text-gray-500 text-sm">{day}</div>
            ))}
            
            {Array.from({ length: startingDay }).map((_, i) => (
              <div key={`empty-${i}`} className="p-3 min-h-[80px]"></div>
            ))}
            
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dayEvents = getEventsForDate(day);
              const isToday = new Date().toDateString() === new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day).toDateString();
              
              return (
                <div
                  key={day}
                  className={`p-2 min-h-[80px] border rounded-lg ${
                    isToday ? 'bg-blue-50 border-blue-300' : 'border-gray-100'
                  }`}
                >
                  <div className={`text-sm font-medium mb-1 ${isToday ? 'text-blue-600' : 'text-gray-700'}`}>{day}</div>
                  <div className="space-y-1">
                    {dayEvents.slice(0, 2).map(event => (
                      <div
                        key={event.id}
                        className={`text-xs px-1.5 py-0.5 rounded truncate ${
                          event.type === 'exam' ? 'bg-blue-100 text-blue-700' :
                          event.type === 'holiday' ? 'bg-red-100 text-red-700' :
                          'bg-green-100 text-green-700'
                        }`}
                      >
                        {event.title}
                      </div>
                    ))}
                    {dayEvents.length > 2 && (
                      <div className="text-xs text-gray-500">+{dayEvents.length - 2} more</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Upcoming Events List */}
          <div className="mt-6 border-t pt-6">
            <h4 className="font-semibold text-gray-800 mb-4">Upcoming Events</h4>
            <div className="space-y-2">
              {calendarEvents
                .filter(e => new Date(e.date) >= new Date())
                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                .slice(0, 5)
                .map(event => (
                  <div key={event.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className={`w-3 h-3 rounded-full ${
                      event.type === 'exam' ? 'bg-blue-500' :
                      event.type === 'holiday' ? 'bg-red-500' :
                      'bg-green-500'
                    }`} />
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{event.title}</p>
                      <p className="text-sm text-gray-500">{new Date(event.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      event.type === 'exam' ? 'bg-blue-100 text-blue-700' :
                      event.type === 'holiday' ? 'bg-red-100 text-red-700' :
                      'bg-green-100 text-green-700'
                    }`}>
                      {event.type}
                    </span>
                  </div>
                ))
              }
              {calendarEvents.filter(e => new Date(e.date) >= new Date()).length === 0 && (
                <p className="text-gray-500 text-center py-4">No upcoming events</p>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'notifications' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
            <Bell className="text-purple-500" /> Notifications from Admin
          </h3>

          {notifications.length === 0 ? (
            <div className="text-center py-12">
              <Bell size={48} className="mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">No notifications yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {notifications.map(notif => (
                <div
                  key={notif.id}
                  className={`p-4 rounded-lg border-l-4 ${
                    !notif.is_read ? 'bg-blue-50 border-blue-500' : 'bg-gray-50 border-gray-300'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-gray-900">{notif.title}</h4>
                        {!notif.is_read && (
                          <span className="px-2 py-0.5 bg-blue-500 text-white text-xs rounded-full">New</span>
                        )}
                        <span className={`px-2 py-0.5 text-xs rounded-full ${
                          notif.priority === 'URGENT' ? 'bg-red-100 text-red-700' :
                          notif.priority === 'HIGH' ? 'bg-orange-100 text-orange-700' :
                          notif.priority === 'NORMAL' ? 'bg-gray-100 text-gray-700' :
                          'bg-gray-100 text-gray-500'
                        }`}>
                          {notif.priority}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700">{notif.message}</p>
                      <p className="text-xs text-gray-500 mt-2">
                        {notif.sent_at ? new Date(notif.sent_at).toLocaleString() : 'Just now'}
                      </p>
                    </div>
                    {!notif.is_read && (
                      <button
                        onClick={() => markAsRead(notif.id)}
                        className="p-2 hover:bg-white rounded-lg text-blue-600"
                        title="Mark as read"
                      >
                        <Check size={18} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
