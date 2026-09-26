'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  LifeBuoy, 
  X, 
  Send, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  MessageSquare, 
  Bug, 
  ChevronRight, 
  Activity,
  RefreshCw,
  ArrowLeft
} from 'lucide-react';
import api from '@/lib/api';
import { FlightRecorder } from '@/lib/telemetry/flightRecorder';

interface TicketMessage {
  id: string;
  sender_name: string;
  sender_role: string;
  is_admin_reply: boolean;
  message: string;
  created_at: string;
}

interface SupportTicket {
  id: string;
  ticket_number: string;
  title: string;
  category: string;
  status: 'OPEN' | 'INVESTIGATING' | 'RESOLVED' | 'CLOSED';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  created_at: string;
  description?: string;
  admin_notes?: string;
  messages?: TicketMessage[];
  unread_messages_count?: number;
}

export default function FloatingSupportWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'create' | 'list'>('create');
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  
  // Form State
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('TECHNICAL_ERROR');
  const [severity, setSeverity] = useState('MEDIUM');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Tickets & Chat State
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [isLoadingTickets, setIsLoadingTickets] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize FlightRecorder on client mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      FlightRecorder.init();
      fetchUnreadCount();
      
      // Poll unread count every 60 seconds
      const interval = setInterval(fetchUnreadCount, 60000);
      return () => clearInterval(interval);
    }
  }, []);

  useEffect(() => {
    if (isOpen && activeTab === 'list') {
      fetchTickets();
    }
  }, [isOpen, activeTab]);

  useEffect(() => {
    if (selectedTicket) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [selectedTicket?.messages]);

  const fetchUnreadCount = async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) return;
      const res = await api.get('/support/tickets/unread_count/');
      setUnreadCount(res.data?.unread_count || 0);
    } catch {}
  };

  const fetchTickets = async () => {
    setIsLoadingTickets(true);
    try {
      const res = await api.get('/support/tickets/');
      const ticketList = Array.isArray(res.data) ? res.data : (res.data?.results || []);
      setTickets(ticketList);
    } catch (err) {
      console.warn('Could not load user tickets', err);
    } finally {
      setIsLoadingTickets(false);
    }
  };

  const fetchTicketDetails = async (ticketId: string) => {
    try {
      const res = await api.get(`/support/tickets/${ticketId}/`);
      setSelectedTicket(res.data);
      fetchUnreadCount();
    } catch (err) {
      console.warn('Could not load ticket details', err);
    }
  };

  const handleSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      setErrorMsg('Please enter both a title and description.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      // 1. Capture full FlightRecorder diagnostic snapshot
      const diagnosticBundle = FlightRecorder.getDiagnosticBundle();

      // 2. Submit ticket + diagnostic telemetry to backend
      const payload = {
        title: title.trim(),
        category,
        severity,
        description: description.trim(),
        current_route: typeof window !== 'undefined' ? window.location.pathname : '',
        diagnostic_data: diagnosticBundle
      };

      const res = await api.post('/support/tickets/', payload);
      setSubmitSuccess(res.data.ticket_number || 'TKT-SUBMITTED');
      setTitle('');
      setDescription('');
      fetchUnreadCount();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Failed to submit report. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !replyText.trim()) return;

    setIsSendingReply(true);
    try {
      const res = await api.post(`/support/tickets/${selectedTicket.id}/add_message/`, {
        message: replyText.trim()
      });
      setSelectedTicket({
        ...selectedTicket,
        messages: [...(selectedTicket.messages || []), res.data]
      });
      setReplyText('');
    } catch (err) {
      console.error('Failed to send reply', err);
    } finally {
      setIsSendingReply(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'OPEN':
        return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-100 text-amber-800 border border-amber-300">Open</span>;
      case 'INVESTIGATING':
        return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 border border-blue-300">Investigating</span>;
      case 'RESOLVED':
        return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">Resolved</span>;
      default:
        return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-gray-100 text-gray-700 border border-gray-300">Closed</span>;
    }
  };

  return (
    <>
      {/* Floating Trigger Bubble */}
      <div className="fixed bottom-6 right-6 z-[9999]">
        <button
          onClick={() => {
            setIsOpen(!isOpen);
            setSubmitSuccess(null);
            setErrorMsg(null);
          }}
          className="group relative flex items-center gap-2.5 bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white px-4 py-3 rounded-full shadow-2xl transition-all duration-300 hover:scale-105 active:scale-95 focus:outline-none focus:ring-4 focus:ring-blue-300"
          aria-label="Support and Error Reporting"
        >
          <div className="relative">
            <LifeBuoy className="w-5 h-5 text-white animate-spin-slow" />
            {unreadCount > 0 && (
              <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[11px] font-bold text-white ring-2 ring-white animate-pulse">
                {unreadCount}
              </span>
            )}
          </div>
          <span className="text-sm font-semibold tracking-wide pr-1">
            Need Help?
          </span>
        </button>
      </div>

      {/* Slide-over Support Drawer */}
      {isOpen && (
        <div className="fixed inset-0 z-[10000] flex justify-end bg-black/40 backdrop-blur-sm transition-opacity">
          <div className="w-full max-w-lg bg-white h-full shadow-2xl flex flex-col overflow-hidden animate-slide-left">
            
            {/* Drawer Header */}
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-5 flex items-center justify-between border-b border-indigo-800/40">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-500/20 rounded-xl border border-indigo-400/30">
                  <LifeBuoy className="w-6 h-6 text-indigo-300" />
                </div>
                <div>
                  <h2 className="text-lg font-bold tracking-tight">School OS Support Desk</h2>
                  <p className="text-xs text-indigo-200/80 flex items-center gap-1.5 mt-0.5">
                    <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    Diagnostics & Flight Recorder Active
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-slate-200 bg-slate-50 px-4 pt-2">
              <button
                onClick={() => {
                  setActiveTab('create');
                  setSelectedTicket(null);
                  setSubmitSuccess(null);
                }}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition ${
                  activeTab === 'create'
                    ? 'border-indigo-600 text-indigo-600 bg-white rounded-t-lg'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <Bug className="w-4 h-4" />
                Report an Issue
              </button>
              <button
                onClick={() => {
                  setActiveTab('list');
                  setSelectedTicket(null);
                }}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition ${
                  activeTab === 'list'
                    ? 'border-indigo-600 text-indigo-600 bg-white rounded-t-lg'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <MessageSquare className="w-4 h-4" />
                My Tickets & Replies
                {unreadCount > 0 && (
                  <span className="px-1.5 py-0.5 text-xs font-bold rounded-full bg-rose-500 text-white">
                    {unreadCount}
                  </span>
                )}
              </button>
            </div>

            {/* Drawer Body Content */}
            <div className="flex-1 overflow-y-auto p-5 bg-slate-50/50">
              
              {/* TAB 1: Report Issue Form */}
              {activeTab === 'create' && (
                <div>
                  {submitSuccess ? (
                    <div className="text-center py-10 px-4 bg-white rounded-2xl border border-emerald-100 shadow-sm">
                      <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                        <CheckCircle2 className="w-8 h-8" />
                      </div>
                      <h3 className="text-xl font-bold text-slate-900">Issue Report Submitted!</h3>
                      <p className="text-sm font-mono text-indigo-600 font-semibold mt-1">Ticket ID: {submitSuccess}</p>
                      <p className="text-xs text-slate-500 mt-3 max-w-sm mx-auto">
                        Your technical logs and error breadcrumbs have been safely bundled and sent to the platform administration team. We will review it shortly.
                      </p>
                      <div className="mt-6 flex justify-center gap-3">
                        <button
                          onClick={() => {
                            setSubmitSuccess(null);
                            setActiveTab('list');
                          }}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-xl transition shadow-sm"
                        >
                          View My Tickets
                        </button>
                        <button
                          onClick={() => setSubmitSuccess(null)}
                          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-xl transition"
                        >
                          Submit Another
                        </button>
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={handleSubmitTicket} className="space-y-4">
                      
                      {/* Telemetry Indicator Card */}
                      <div className="p-3.5 bg-indigo-50/80 border border-indigo-100 rounded-xl flex items-start gap-3">
                        <Activity className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-semibold text-indigo-900">Automatic Diagnostic Capture</p>
                          <p className="text-[11px] text-indigo-700/80 mt-0.5">
                            Recent console errors, failed API responses, and browser specifications on your device will be attached securely to help administrators resolve your issue.
                          </p>
                        </div>
                      </div>

                      {errorMsg && (
                        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 flex-shrink-0" />
                          <span>{errorMsg}</span>
                        </div>
                      )}

                      {/* Title */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Issue Subject / Short Summary <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          placeholder="e.g., Error saving student marks, Page loading stuck"
                          className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                      </div>

                      {/* Category & Severity Grid */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">Category</label>
                          <select
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          >
                            <option value="TECHNICAL_ERROR">Technical Error / Crash</option>
                            <option value="UI_BUG">UI / Display Issue</option>
                            <option value="PERFORMANCE">Slow Performance / Timeout</option>
                            <option value="DATA_ISSUE">Data Inconsistency</option>
                            <option value="FEATURE_REQUEST">Feature Request</option>
                            <option value="GENERAL">General Inquiry</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">Severity</label>
                          <select
                            value={severity}
                            onChange={(e) => setSeverity(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          >
                            <option value="LOW">Low (Minor annoyance)</option>
                            <option value="MEDIUM">Medium (Normal)</option>
                            <option value="HIGH">High (Blocking task)</option>
                            <option value="CRITICAL">Critical (System unusable)</option>
                          </select>
                        </div>
                      </div>

                      {/* Description */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Detailed Description <span className="text-rose-500">*</span>
                        </label>
                        <textarea
                          required
                          rows={5}
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          placeholder="Please explain what you were doing when the issue occurred..."
                          className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
                        />
                      </div>

                      {/* Submit Button */}
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold rounded-xl transition shadow-md shadow-indigo-200 mt-2"
                      >
                        {isSubmitting ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span>Bundling Diagnostics & Submitting...</span>
                          </>
                        ) : (
                          <>
                            <Send className="w-4 h-4" />
                            <span>Submit Complaint & Diagnostics</span>
                          </>
                        )}
                      </button>
                    </form>
                  )}
                </div>
              )}

              {/* TAB 2: Tickets List & Two-Way Thread */}
              {activeTab === 'list' && (
                <div>
                  {selectedTicket ? (
                    // Conversation View
                    <div className="flex flex-col h-[520px] bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                      
                      {/* Ticket Header in Chat */}
                      <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                        <button
                          onClick={() => setSelectedTicket(null)}
                          className="flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-indigo-600 transition"
                        >
                          <ArrowLeft className="w-4 h-4" />
                          Back to Tickets
                        </button>
                        <div>{getStatusBadge(selectedTicket.status)}</div>
                      </div>

                      <div className="p-3.5 bg-indigo-50/40 border-b border-slate-100">
                        <p className="text-xs font-mono text-indigo-700 font-bold">{selectedTicket.ticket_number}</p>
                        <h4 className="text-sm font-bold text-slate-900 mt-0.5">{selectedTicket.title}</h4>
                      </div>

                      {/* Messages Stream */}
                      <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-50/30">
                        
                        {/* Initial User Complaint */}
                        <div className="flex flex-col items-end">
                          <div className="max-w-[85%] bg-indigo-600 text-white p-3 rounded-2xl rounded-tr-none text-xs shadow-sm">
                            <p className="font-semibold text-[10px] text-indigo-200 mb-1">Your Complaint:</p>
                            <p className="whitespace-pre-wrap">{selectedTicket.description}</p>
                          </div>
                          <span className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(selectedTicket.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>

                        {/* Thread Messages */}
                        {selectedTicket.messages && selectedTicket.messages.map((msg) => (
                          <div
                            key={msg.id}
                            className={`flex flex-col ${msg.is_admin_reply ? 'items-start' : 'items-end'}`}
                          >
                            <div
                              className={`max-w-[85%] p-3 rounded-2xl text-xs shadow-sm ${
                                msg.is_admin_reply
                                  ? 'bg-white text-slate-800 border border-slate-200 rounded-tl-none ring-1 ring-slate-100'
                                  : 'bg-indigo-600 text-white rounded-tr-none'
                              }`}
                            >
                              <div className="flex items-center gap-1.5 mb-1 font-bold text-[10px]">
                                {msg.is_admin_reply ? (
                                  <span className="text-indigo-600 font-bold flex items-center gap-1">
                                    <LifeBuoy className="w-3 h-3" />
                                    School OS Support Team
                                  </span>
                                ) : (
                                  <span className="text-indigo-200">You</span>
                                )}
                              </div>
                              <p className="whitespace-pre-wrap leading-relaxed">{msg.message}</p>
                            </div>
                            <span className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        ))}

                        <div ref={messagesEndRef} />
                      </div>

                      {/* Reply Input Box */}
                      <form onSubmit={handleSendReply} className="p-3 bg-white border-t border-slate-200 flex gap-2">
                        <input
                          type="text"
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          placeholder="Type your reply to the support team..."
                          className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        <button
                          type="submit"
                          disabled={isSendingReply || !replyText.trim()}
                          className="p-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-xl transition"
                        >
                          <Send className="w-4 h-4" />
                        </button>
                      </form>
                    </div>
                  ) : (
                    // Tickets List
                    <div className="space-y-3">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Your Submitted Tickets</h3>
                        <button
                          onClick={fetchTickets}
                          className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1 font-semibold"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${isLoadingTickets ? 'animate-spin' : ''}`} />
                          Refresh
                        </button>
                      </div>

                      {isLoadingTickets ? (
                        <div className="text-center py-12 text-slate-400 text-xs">
                          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
                          Loading tickets...
                        </div>
                      ) : tickets.length === 0 ? (
                        <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 p-6">
                          <CheckCircle2 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                          <p className="text-sm font-bold text-slate-700">No Tickets Yet</p>
                          <p className="text-xs text-slate-400 mt-1">If you experience any technical errors, report them using the first tab.</p>
                        </div>
                      ) : (
                        tickets.map((t) => (
                          <div
                            key={t.id}
                            onClick={() => fetchTicketDetails(t.id)}
                            className="p-3.5 bg-white hover:bg-indigo-50/50 border border-slate-200 hover:border-indigo-300 rounded-xl cursor-pointer transition shadow-sm hover:shadow flex items-center justify-between group"
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] font-mono font-bold text-indigo-600">{t.ticket_number}</span>
                                {getStatusBadge(t.status)}
                                {(t.unread_messages_count || 0) > 0 && (
                                  <span className="px-1.5 py-0.2 bg-rose-500 text-white text-[10px] font-bold rounded-full animate-pulse">
                                    New Reply
                                  </span>
                                )}
                              </div>
                              <h4 className="text-xs font-bold text-slate-900 line-clamp-1">{t.title}</h4>
                              <p className="text-[11px] text-slate-400">
                                {new Date(t.created_at).toLocaleDateString()} at {new Date(t.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 transition group-hover:translate-x-0.5" />
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

          </div>
        </div>
      )}
    </>
  );
}
