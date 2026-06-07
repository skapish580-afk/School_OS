'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { Library, BookOpen, Search, Filter, Plus, Bookmark, Loader2, ArrowUpRight, History, Users, Banknote } from 'lucide-react';
import Modal from '@/components/Modal';

export default function LibraryPage() {
  const [books, setBooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingBookId, setEditingBookId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const [policy, setPolicy] = useState<any>(null);
  const [policyFormData, setPolicyFormData] = useState<any>({
    max_books_student: 2,
    max_books_teacher: 5,
    max_duration_student: 14,
    max_duration_teacher: 30,
    per_day_late_fee: 5,
    lost_book_fine: 500,
    damaged_book_fine: 200,
    worn_book_fine: 50
  });
  const [formData, setFormData] = useState<any>({
    title: '',
    author: '',
    isbn: '',
    accession_number: '',
    category: '',
    publisher: '',
    total_copies: 1,
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showLogsDropdown, setShowLogsDropdown] = useState(false);
  const [selectedBook, setSelectedBook] = useState<any>(null);

  useEffect(() => {
    fetchBooks();
    fetchPolicy();
  }, []);

  const fetchPolicy = async () => {
    try {
      const res = await api.get('/library/policy/current/');
      setPolicy(res.data);
      setPolicyFormData(res.data);
    } catch (err) {
      console.error('Failed to fetch policy', err);
    }
  };

  const fetchBooks = async () => {
    try {
      const res = await api.get('/library/books/');
      setBooks(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddBook = async () => {
    setSubmitting(true);
    setError('');
    try {
      if (isEditing && editingBookId) {
        await api.put(`/library/books/${editingBookId}/`, formData);
        setIsEditing(false);
        setEditingBookId(null);
      } else {
        await api.post('/library/books/', formData);
      }
      setShowAddModal(false);
      resetForm();
      fetchBooks();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to save book. Accession number must be unique.');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setIsEditing(false);
    setEditingBookId(null);
    setFormData({
      title: '',
      author: '',
      isbn: '',
      accession_number: '',
      category: '',
      publisher: '',
      total_copies: 1,
    });
  };

  const handleUpdatePolicy = async () => {
    setSubmitting(true);
    setError('');
    try {
      await api.post('/library/policy/current/', policyFormData);
      setShowPolicyModal(false);
      fetchPolicy();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to update policy.');
    } finally {
      setSubmitting(false);
    }
  };

  const openEditModal = (book: any) => {
    setFormData({
      title: book.title,
      author: book.author,
      isbn: book.isbn || '',
      accession_number: book.accession_number,
      category: book.category || '',
      publisher: book.publisher || '',
      total_copies: book.total_copies,
    });
    setIsEditing(true);
    setEditingBookId(book.id);
    setShowAddModal(true);
  };

  const fields: any[] = [
    { name: 'title', label: 'Title', type: 'text', required: true },
    { name: 'author', label: 'Author', type: 'text', required: true },
    { name: 'isbn', label: 'ISBN', type: 'text' },
    { name: 'accession_number', label: 'Accession Number', type: 'text', required: true },
    { name: 'category', label: 'Category', type: 'text' },
    { name: 'publisher', label: 'Publisher', type: 'text' },
    { name: 'total_copies', label: 'Total Copies', type: 'number', min: 1, required: true },
  ];

  const policyFields: any[] = [
    { name: 'max_books_student', label: 'Max Books (Student)', type: 'number', required: true },
    { name: 'max_books_teacher', label: 'Max Books (Teacher)', type: 'number', required: true },
    { name: 'max_duration_student', label: 'Max Duration Student (Days)', type: 'number', required: true },
    { name: 'max_duration_teacher', label: 'Max Duration Teacher (Days)', type: 'number', required: true },
    { name: 'per_day_late_fee', label: 'Late Fee (Per Day)', type: 'number', required: true },
    { name: 'lost_book_fine', label: 'Lost Book Fine', type: 'number', required: true },
    { name: 'damaged_book_fine', label: 'Damaged Book Fine', type: 'number', required: true },
    { name: 'worn_book_fine', label: 'Worn Book Fine', type: 'number', required: true },
  ];

  const allCategories = useMemo(() => {
    const cats = books.map(b => b.category).filter(Boolean);
    return Array.from(new Set(cats));
  }, [books]);

  const filteredBooks = useMemo(() => {
    return books.filter(book => {
      const matchesSearch = 
        book.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        book.author.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (book.isbn && book.isbn.toLowerCase().includes(searchTerm.toLowerCase())) ||
        book.accession_number.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesCategory = selectedCategory === '' || book.category === selectedCategory;
      
      return matchesSearch && matchesCategory;
    });
  }, [books, searchTerm, selectedCategory]);

  const stats = {
    total: books.length,
    issued: books.reduce((acc, b) => acc + (b.total_copies - b.available_copies), 0),
    available: books.reduce((acc, b) => acc + b.available_copies, 0)
  };

  // Aggregate categories for simple chart
  const categories = books.reduce((acc: any, book: any) => {
    acc[book.category] = (acc[book.category] || 0) + 1;
    return acc;
  }, {});

  const topCategories = Object.entries(categories)
    .map(([name, count]: any) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">📚 Library Management</h1>
          <p className="text-slate-500 font-medium">Inventory, issues, and fine tracking.</p>
        </div>
        <div className="flex gap-3">
          <div className="relative">
            <button 
              onClick={() => setShowLogsDropdown(!showLogsDropdown)}
              className="bg-white text-slate-700 px-4 py-2.5 rounded-xl font-bold border border-slate-200 hover:bg-slate-50 transition shadow-sm flex items-center gap-2"
            >
              <History size={18} /> Logs
            </button>
            
            {showLogsDropdown && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowLogsDropdown(false)}></div>
                <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-xl shadow-xl z-20 py-2 animate-in fade-in zoom-in duration-200">
                  <Link href="/dashboard/library/logs/circulation" className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 transition-colors">
                    <BookOpen size={16} /> Circulation Log
                  </Link>
                  <Link href="/dashboard/library/logs/stock" className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 transition-colors">
                    <Library size={16} /> Stock Register
                  </Link>
                  <Link href="/dashboard/library/logs/visitor" className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 transition-colors">
                    <Users size={16} /> Visitor Log
                  </Link>
                  <Link href="/dashboard/library/logs/fines" className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 transition-colors">
                    <Banknote size={16} /> Fines & Fees
                  </Link>
                </div>
              </>
            )}
          </div>
          <button 
            onClick={() => { resetForm(); setShowAddModal(true); }}
            className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition shadow-lg shadow-indigo-100 flex items-center gap-2"
          >
            <Plus size={20} /> Add Book
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: 'Total Books', value: stats.total, icon: Library, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { label: 'Currently Issued', value: stats.issued, icon: BookOpen, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Available', value: stats.available, icon: Bookmark, color: 'text-amber-600', bg: 'bg-amber-50' },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4 hover:shadow-md transition-all">
            <div className={`p-3 ${stat.bg} ${stat.color} rounded-xl shadow-inner`}>
              <stat.icon size={24} />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">{stat.label}</p>
              <p className="text-2xl font-black text-slate-900">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Book List */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex gap-4 ring-1 ring-slate-100">
            <div className="flex-1 relative">
               <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
               <input 
                 type="text" 
                 placeholder="Search books by title, author, or ISBN..." 
                 className="w-full pl-11 pr-4 py-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium focus:bg-white transition-all"
                 value={searchTerm}
                 onChange={(e) => setSearchTerm(e.target.value)}
               />
            </div>
            <div className="relative">
              <button 
                onClick={() => setShowFilters(!showFilters)}
                className={`px-4 py-3 rounded-xl transition flex items-center gap-2 ${showFilters || selectedCategory ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                 <Filter size={20} />
                 {selectedCategory && <span className="text-xs font-bold uppercase hidden md:inline">{selectedCategory}</span>}
              </button>
              
              {showFilters && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowFilters(false)}></div>
                  <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-200 rounded-xl shadow-xl z-20 py-2 animate-in fade-in zoom-in duration-200">
                    <button 
                      onClick={() => { setSelectedCategory(''); setShowFilters(false); }}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-50 transition-colors ${selectedCategory === '' ? 'font-bold text-indigo-600 bg-indigo-50/50' : 'text-slate-600'}`}
                    >
                      All Categories
                    </button>
                    {allCategories.map(cat => (
                      <button 
                        key={cat}
                        onClick={() => { setSelectedCategory(cat); setShowFilters(false); }}
                        className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-50 transition-colors ${selectedCategory === cat ? 'font-bold text-indigo-600 bg-indigo-50/50' : 'text-slate-600'}`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-left">
               <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase font-black tracking-[0.1em]">
                  <tr>
                     <th className="px-6 py-4">Book Details</th>
                     <th className="px-6 py-4">Category</th>
                     <th className="px-6 py-4">Status</th>
                     <th className="px-6 py-4">Shelf No</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={4} className="p-10 text-center">
                        <Loader2 className="animate-spin mx-auto text-indigo-600" size={32} />
                      </td>
                    </tr>
                  ) : filteredBooks.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-10 text-center text-slate-400 font-medium italic">
                        {searchTerm || selectedCategory ? 'No books match your filters.' : 'No books in inventory yet.'}
                      </td>
                    </tr>
                  ) : filteredBooks.map((book, i) => (
                    <tr 
                      key={i} 
                      onClick={() => setSelectedBook(book)}
                      className="hover:bg-indigo-50/20 transition group cursor-pointer"
                    >
                       <td className="px-6 py-4">
                          <p className="font-bold text-slate-900 group-hover:text-indigo-700 transition-colors">{book.title}</p>
                          <p className="text-xs text-slate-500 font-medium">{book.author}</p>
                       </td>
                       <td className="px-6 py-4">
                          <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-1 rounded-md">{book.category}</span>
                       </td>
                       <td className="px-6 py-4">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-black tracking-tight ${book.available_copies > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                             {book.available_copies > 0 ? 'AVAILABLE' : 'OUT OF STOCK'}
                          </span>
                       </td>
                       <td className="px-6 py-4 text-xs font-mono font-bold text-slate-400">{book.accession_number}</td>
                    </tr>
                  ))}
               </tbody>
            </table>
          </div>
        </div>

        {/* Sidebar Analytics */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
            <h3 className="font-bold text-slate-900 mb-6 flex justify-between items-center">
              Popular Categories <ArrowUpRight size={18} className="text-slate-300" />
            </h3>
            <div className="space-y-4">
              {topCategories.map((cat: any) => (
                <div key={cat.name} className="space-y-2">
                  <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-slate-600">
                    <span>{cat.name}</span>
                    <span className="text-indigo-600">{cat.count} Books</span>
                  </div>
                  <div className="h-2 w-full bg-slate-50 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-indigo-500 rounded-full" 
                      style={{ width: `${(cat.count / stats.total) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-gradient-to-br from-indigo-700 to-blue-800 p-8 rounded-3xl text-white shadow-xl shadow-indigo-100 relative overflow-hidden group">
            <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700"></div>
            <h3 className="font-bold text-xl mb-3 relative z-10">Library Rules</h3>
            <div className="text-indigo-100 text-[10px] mb-6 space-y-2 relative z-10 opacity-90 font-medium">
              <p>• Max Books: Stu({policy?.max_books_student}) | Tea({policy?.max_books_teacher})</p>
              <p>• Duration: Stu({policy?.max_duration_student}d) | Tea({policy?.max_duration_teacher}d)</p>
              <p>• Late Fee: ₹{policy?.per_day_late_fee}/day</p>
              <p>• Fines: Lost(₹{policy?.lost_book_fine}) | Damaged(₹{policy?.damaged_book_fine}) | Worn(₹{policy?.worn_book_fine})</p>
            </div>
            <button 
              onClick={() => setShowPolicyModal(true)}
              className="w-full bg-white text-indigo-700 py-3 rounded-xl font-bold text-sm shadow-xl hover:bg-white/90 active:scale-95 transition-all relative z-10"
            >
              Update Policy
            </button>
          </div>
        </div>
      </div>

      <Modal
        isOpen={showAddModal}
        onClose={() => { resetForm(); setShowAddModal(false); }}
        title={isEditing ? "Edit Book Details" : "Add New Book"}
        fields={fields}
        formData={formData}
        onFormChange={(name, value) => setFormData({ ...formData, [name]: value })}
        onSubmit={handleAddBook}
        loading={submitting}
        error={error}
        submitButtonText={isEditing ? "Update Book" : "Add Book"}
        color="indigo"
      />

      <Modal
        isOpen={!!selectedBook}
        onClose={() => setSelectedBook(null)}
        title="📖 Book Details"
      >
        {selectedBook && (
          <div className="space-y-4 py-2">
            <div className="bg-slate-50 p-4 rounded-2xl space-y-3">
              {[
                { label: 'Title', value: selectedBook.title, bold: true },
                { label: 'Author', value: selectedBook.author },
                { label: 'ISBN', value: selectedBook.isbn || 'N/A' },
                { label: 'Accession No.', value: selectedBook.accession_number, mono: true, color: 'text-indigo-600' },
                { label: 'Category', value: selectedBook.category },
                { label: 'Publisher', value: selectedBook.publisher || 'N/A' },
                { label: 'Total Copies', value: selectedBook.total_copies },
                { 
                  label: 'Available', 
                  value: selectedBook.available_copies, 
                  color: selectedBook.available_copies > 0 ? 'text-green-600' : 'text-red-600',
                  bold: true 
                },
              ].map((item, i) => (
                <div key={i} className="flex justify-between items-center text-sm border-b border-slate-200/50 pb-2 last:border-0 last:pb-0">
                  <span className="text-slate-500 font-medium">{item.label}</span>
                  <span className={`${item.bold ? 'font-bold' : 'font-semibold'} ${item.mono ? 'font-mono' : ''} ${item.color || 'text-slate-900'}`}>
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <button 
                onClick={() => { setSelectedBook(null); openEditModal(selectedBook); }}
                className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition active:scale-[0.98]"
              >
                Edit Details
              </button>
              <button 
                onClick={() => setSelectedBook(null)}
                className="flex-1 bg-slate-100 text-slate-700 py-3 rounded-xl font-bold hover:bg-slate-200 transition active:scale-[0.98]"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={showPolicyModal}
        onClose={() => setShowPolicyModal(false)}
        title="⚙️ Update Library Policy"
        fields={policyFields}
        formData={policyFormData}
        onFormChange={(name, value) => setPolicyFormData({ ...policyFormData, [name]: value })}
        onSubmit={handleUpdatePolicy}
        loading={submitting}
        error={error}
        submitButtonText="Update Policy"
        color="indigo"
      />
    </div>
  );
}
