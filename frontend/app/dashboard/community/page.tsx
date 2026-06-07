'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { Globe, MessageSquare, UserPlus, Search, MapPin, Send, TrendingUp, Filter } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function CommunityPage() {
  const [activeTab, setActiveTab] = useState<'forum' | 'alumni'>('forum');
  const [posts, setPosts] = useState<any[]>([]);
  const [alumni, setAlumni] = useState<any[]>([]);
  const [schools, setSchools] = useState<any[]>([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [scope, setScope] = useState<'all' | 'global' | 'school' | 'city'>('all');
  
  // New post state
  const [newPostTitle, setNewPostTitle] = useState('');
  const [newPostContent, setNewPostContent] = useState('');
  const [isPosting, setIsPosting] = useState(false);

  // Comments state
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null);
  const [newCommentText, setNewCommentText] = useState<Record<string, string>>({});
  const [isCommenting, setIsCommenting] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchSchools();
  }, []);

  useEffect(() => {
    fetchData();
  }, [activeTab, scope, selectedSchoolId]);

  const fetchSchools = async () => {
    try {
      const res = await api.get('/community/schools/');
      setSchools(res.data);
    } catch (err) {
      console.error('Failed to load schools list', err);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'forum') {
        const res = await api.get(`/community/posts/?scope=${scope}`);
        setPosts(res.data);
      } else {
        const res = await api.get(`/community/alumni-directory/?search=${search}&school_id=${selectedSchoolId}`);
        setAlumni(res.data);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load community data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePost = async () => {
    if (!newPostContent.trim()) return;
    setIsPosting(true);
    try {
      await api.post('/community/posts/', {
        title: newPostTitle || 'New Discussion',
        content: newPostContent,
        is_global: scope === 'global' || scope === 'all'
      });
      setNewPostTitle('');
      setNewPostContent('');
      toast.success('Post created successfully!');
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error('Failed to create post');
    } finally {
      setIsPosting(false);
    }
  };

  const handleCreateComment = async (postId: string) => {
    const content = newCommentText[postId];
    if (!content || !content.trim()) return;

    setIsCommenting(prev => ({ ...prev, [postId]: true }));
    try {
      await api.post(`/community/posts/${postId}/add_comment/`, {
        content: content
      });
      setNewCommentText(prev => ({ ...prev, [postId]: '' }));
      toast.success('Comment added!');
      fetchData(); // Refresh posts to show comments inline
    } catch (err) {
      console.error(err);
      toast.error('Failed to add comment');
    } finally {
      setIsCommenting(prev => ({ ...prev, [postId]: false }));
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">School OS Community</h1>
          <p className="text-slate-500">Connect with parents, alumni, and the global network.</p>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-xl shadow-inner self-start md:self-center">
          <button 
            onClick={() => setActiveTab('forum')}
            className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === 'forum' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <div className="flex items-center gap-2">
              <MessageSquare size={16} /> Forum
            </div>
          </button>
          <button 
            onClick={() => setActiveTab('alumni')}
            className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === 'alumni' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <div className="flex items-center gap-2">
              <Globe size={16} /> Alumni Directory
            </div>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {activeTab === 'forum' ? (
            <div className="space-y-6">
              {/* Scope Filters */}
              <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-hide">
                <Filter size={16} className="text-slate-400 shrink-0" />
                {[
                  { id: 'all', label: 'All Activity' },
                  { id: 'school', label: 'My School' },
                  { id: 'city', label: 'City Parent Connect' },
                  { id: 'global', label: 'Global Network' },
                ].map(item => (
                  <button
                    key={item.id}
                    onClick={() => setScope(item.id as any)}
                    className={`whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-bold border transition-all ${
                      scope === item.id 
                      ? 'bg-blue-600 border-blue-600 text-white shadow-md' 
                      : 'bg-white border-slate-200 text-slate-600 hover:border-blue-300'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {/* New Post Card */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm ring-1 ring-slate-200/50">
                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-inner">
                    Me
                  </div>
                  <div className="flex-1 space-y-3">
                    <input 
                      type="text"
                      placeholder="Discussion Title (Optional)"
                      className="w-full bg-slate-50 rounded-xl px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none border border-transparent focus:bg-white transition-all"
                      value={newPostTitle}
                      onChange={(e) => setNewPostTitle(e.target.value)}
                    />
                    <textarea 
                      placeholder="Start a conversation with the community..."
                      className="w-full bg-slate-50 rounded-xl p-4 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none min-h-[120px] border border-transparent focus:bg-white transition-all"
                      value={newPostContent}
                      onChange={(e) => setNewPostContent(e.target.value)}
                    />
                    <div className="flex justify-end pt-2">
                      <button 
                        onClick={handleCreatePost}
                        disabled={isPosting || !newPostContent.trim()}
                        className="bg-blue-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none shadow-lg shadow-blue-200"
                      >
                        {isPosting ? 'Posting...' : <><Send size={16} /> Post</>}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {loading ? (
                <div className="flex flex-col items-center justify-center p-12 space-y-4">
                  <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-slate-400 font-medium">Loading community feed...</p>
                </div>
              ) : posts.length === 0 ? (
                <div className="p-12 text-center text-slate-400 bg-white rounded-2xl border border-dashed border-slate-300">
                  <MessageSquare size={48} className="mx-auto mb-4 opacity-20" />
                  <p className="font-medium text-slate-500">No posts in this category yet.</p>
                  <p className="text-sm">Be the first to start a discussion!</p>
                </div>
              ) : (
                posts.map(post => (
                  <div key={post.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all group">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold border border-slate-200 shadow-inner group-hover:bg-blue-50 transition-colors">
                        {post.author_name?.charAt(0)}
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 group-hover:text-blue-700 transition-colors">{post.author_name}</h4>
                        <span className="text-xs text-slate-500 font-medium">{new Date(post.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      </div>
                      <div className="ml-auto flex gap-2">
                        {post.is_global && (
                          <span className="bg-indigo-50 text-indigo-600 text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider ring-1 ring-indigo-100">Global</span>
                        )}
                        {post.city_localized && (
                          <span className="bg-emerald-50 text-emerald-600 text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider ring-1 ring-emerald-100">{post.city_localized}</span>
                        )}
                      </div>
                    </div>
                    <h3 className="font-bold text-xl mb-3 text-slate-900 leading-tight">{post.title}</h3>
                    <p className="text-slate-600 text-sm leading-relaxed mb-6 whitespace-pre-wrap">{post.content}</p>
                    
                    <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                      <button 
                        onClick={() => setExpandedPostId(expandedPostId === post.id ? null : post.id)}
                        className="flex items-center gap-2 text-slate-500 hover:text-blue-600 transition-colors text-sm font-semibold"
                      >
                        <MessageSquare size={18} /> {post.comments_count || 0} Comments
                      </button>
                      <button 
                        onClick={() => setExpandedPostId(expandedPostId === post.id ? null : post.id)}
                        className="text-slate-400 hover:text-blue-600 transition-colors text-xs font-bold flex items-center gap-1.5 uppercase tracking-wider"
                      >
                        {expandedPostId === post.id ? 'Hide Discussion ↑' : 'View Discussion →'}
                      </button>
                    </div>

                    {/* Comments section */}
                    {expandedPostId === post.id && (
                      <div className="mt-6 pt-6 border-t border-slate-100 space-y-4">
                        <h4 className="font-bold text-slate-800 text-sm">Discussion ({post.comments?.length || 0})</h4>
                        
                        <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                          {(!post.comments || post.comments.length === 0) ? (
                            <p className="text-slate-400 text-xs py-2 italic">No comments yet. Start the discussion below!</p>
                          ) : (
                            post.comments.map((comment: any) => (
                              <div key={comment.id} className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 space-y-1 text-sm">
                                <div className="flex items-center gap-2">
                                  <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-[10px]">
                                    {comment.author_name?.charAt(0) || 'A'}
                                  </div>
                                  <span className="font-bold text-slate-800 text-xs">{comment.author_name}</span>
                                  <span className="text-[10px] text-slate-400 font-medium">
                                    {new Date(comment.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>
                                <p className="text-slate-600 pl-7 text-xs leading-relaxed">{comment.content}</p>
                              </div>
                            ))
                          )}
                        </div>

                        {/* Add comment */}
                        <div className="flex gap-3 pt-3 border-t border-slate-50">
                          <input
                            type="text"
                            placeholder="Write a reply..."
                            className="flex-1 bg-slate-50 rounded-xl px-4 py-2.5 text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none border border-transparent focus:bg-white transition-all"
                            value={newCommentText[post.id] || ''}
                            onChange={(e) => setNewCommentText(prev => ({ ...prev, [post.id]: e.target.value }))}
                            onKeyPress={(e) => e.key === 'Enter' && handleCreateComment(post.id)}
                          />
                          <button
                            onClick={() => handleCreateComment(post.id)}
                            disabled={isCommenting[post.id] || !(newCommentText[post.id] || '').trim()}
                            className="bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none"
                          >
                            {isCommenting[post.id] ? 'Posting...' : 'Reply'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1 group">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={20} />
                  <input 
                    type="text" 
                    placeholder="Search alumni by name..."
                    className="w-full pl-12 pr-4 py-4 bg-white rounded-2xl border border-slate-200 focus:ring-4 focus:ring-blue-100 outline-none shadow-sm transition-all text-sm font-medium"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && fetchData()}
                  />
                </div>
                <div className="w-full sm:w-64">
                  <select
                    className="w-full py-4 px-4 bg-white rounded-2xl border border-slate-200 focus:ring-4 focus:ring-blue-100 outline-none shadow-sm transition-all text-sm font-semibold text-slate-700 cursor-pointer"
                    value={selectedSchoolId}
                    onChange={(e) => setSelectedSchoolId(e.target.value)}
                  >
                    <option value="">All Schools</option>
                    {schools.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.display_name || s.legal_name} ({s.city})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {loading ? (
                 <div className="flex flex-col items-center justify-center p-12 space-y-4">
                   <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                   <p className="text-slate-400 font-medium">Searching alumni records...</p>
                 </div>
              ) : alumni.length === 0 ? (
                <div className="p-12 text-center text-slate-400 bg-white rounded-2xl border border-dashed border-slate-300">
                  <UserPlus size={48} className="mx-auto mb-4 opacity-20" />
                  <p className="font-medium text-slate-500">No alumni found.</p>
                  <p className="text-sm">Try searching for a different name or city.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   {alumni.map(person => (
                      <div key={person.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4 hover:shadow-md transition-all hover:border-blue-200 cursor-pointer">
                        <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-2xl font-bold border border-blue-100 shadow-inner">
                          {person.full_name?.charAt(0)}
                        </div>
                        <div className="flex-1">
                          <h4 className="font-bold text-slate-900 mb-0.5">{person.full_name}</h4>
                          <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-2 font-medium">
                            <MapPin size={12} className="text-blue-500" /> {person.school?.display_name || person.school?.legal_name || 'Alumni'} ({person.school?.city || 'India'})
                          </div>
                          <button 
                            onClick={() => {
                              toast(`Connecting feature is coming soon! You can email ${person.full_name} at ${person.email || 'N/A'}`, { icon: 'ℹ️' });
                            }}
                            className="bg-slate-50 hover:bg-blue-600 hover:text-white text-blue-600 text-[10px] px-3 py-1.5 rounded-lg font-extrabold uppercase tracking-widest transition-all"
                          >
                            Connect
                          </button>
                        </div>
                      </div>
                   ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sidebar Cards */}
        <div className="space-y-6">
           <div className="bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-800 p-8 rounded-3xl text-white shadow-xl shadow-blue-200 relative overflow-hidden group">
              <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700"></div>
              <h3 className="font-bold text-xl mb-3 relative z-10">Build Your Network</h3>
              <p className="text-blue-100 text-sm mb-6 leading-relaxed relative z-10">School OS connects over 500 schools and 1M+ students. Join the conversation and unlock global opportunities.</p>
              <button className="w-full bg-white text-blue-700 py-3 rounded-xl font-bold text-sm shadow-xl hover:bg-blue-50 active:scale-95 transition-all relative z-10">
                Invite Connections
              </button>
           </div>

           <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm ring-1 ring-slate-100">
              <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
                <TrendingUp size={18} className="text-blue-600" /> Trending Topics
              </h3>
              <div className="space-y-4">
                {[
                  { tag: '#Graduation2026', count: '4.2k' },
                  { tag: '#ParentTeacherConnect', count: '1.8k' },
                  { tag: '#STEMWorkshops', count: '942' },
                  { tag: '#FootballFinals', count: '2.4k' }
                ].map(item => (
                  <div key={item.tag} className="flex items-center justify-between group cursor-pointer hover:bg-slate-50 p-2 -m-2 rounded-lg transition-colors">
                    <span className="text-sm font-semibold text-slate-600 group-hover:text-blue-600 transition-colors">{item.tag}</span>
                    <span className="text-[10px] bg-slate-100 text-slate-500 px-2.5 py-1 rounded-full font-bold">{item.count}</span>
                  </div>
                ))}
              </div>
              <button className="w-full mt-6 text-blue-600 text-xs font-bold uppercase tracking-widest hover:underline">
                View All Topics
              </button>
           </div>
        </div>
      </div>
    </div>
  );
}
