'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Plus, Loader2, Edit2, Trash2, DollarSign, Tag, ArrowLeft } from 'lucide-react';
import Modal from '@/components/Modal';

interface FeeCategory {
  id: number;
  name: string;
  amount: string;
  description: string;
}

export default function FeeCategoriesPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<FeeCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    amount: '',
    description: '',
  });

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const response = await api.get('/finance/categories/');
      setCategories(response.data);
    } catch (error) {
      console.error('Failed to load categories', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (data: Record<string, string | number | boolean>) => {
    setSubmitting(true);
    setError('');
    try {
      if (editingId) {
        await api.put(`/finance/categories/${editingId}/`, {
          name: data.name,
          amount: parseFloat(data.amount as string),
          description: data.description || '',
        });
      } else {
        await api.post('/finance/categories/', {
          name: data.name,
          amount: parseFloat(data.amount as string),
          description: data.description || '',
        });
      }
      setShowModal(false);
      setEditingId(null);
      setFormData({ name: '', amount: '', description: '' });
      fetchCategories();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to save category');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm('Are you sure you want to delete this fee category? This cannot be undone.')) {
      try {
        await api.delete(`/finance/categories/${id}/`);
        fetchCategories();
      } catch (error) {
        alert('Failed to delete category');
      }
    }
  };

  const handleEdit = (category: FeeCategory) => {
    setEditingId(category.id);
    setFormData({
      name: category.name,
      amount: category.amount,
      description: category.description,
    });
    setShowModal(true);
  };

  const fields = [
    {
      name: 'name',
      label: 'Fee Category Name',
      type: 'text' as const,
      required: true,
      placeholder: 'e.g., Tuition Fee - Grade 10',
    },
    {
      name: 'amount',
      label: 'Amount (₹)',
      type: 'number' as const,
      required: true,
      placeholder: '5000',
      min: 0,
    },
    {
      name: 'description',
      label: 'Description (Optional)',
      type: 'textarea' as const,
      placeholder: 'Additional details about this fee...',
    },
  ];

  if (loading) {
    return (
      <div className="flex justify-center items-center p-12">
        <Loader2 className="animate-spin text-green-600" size={40} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/dashboard/finance')}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
          >
            <ArrowLeft size={20} className="text-gray-600" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Fee Categories</h1>
            <p className="text-gray-600 mt-1">Manage fee types for invoices</p>
          </div>
        </div>
        <button
          onClick={() => {
            setEditingId(null);
            setFormData({ name: '', amount: '', description: '' });
            setShowModal(true);
          }}
          className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-medium transition flex items-center gap-2"
        >
          <Plus size={20} /> Add Category
        </button>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl">
        <p className="text-sm text-blue-800">
          <strong>💡 Tip:</strong> Create fee categories like "Tuition Fee", "Lab Fee", "Sports Fee", etc. 
          These will be available when creating invoices for students.
        </p>
      </div>

      {/* Categories Grid */}
      {categories.length === 0 ? (
        <div className="bg-gray-50 p-12 rounded-xl text-center text-gray-500">
          <Tag size={48} className="mx-auto mb-4 text-gray-400" />
          <p className="text-lg font-medium">No fee categories yet</p>
          <p className="text-sm mt-2">Add your first fee category to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((category) => (
            <div
              key={category.id}
              className="bg-white p-6 rounded-xl border border-gray-200 hover:shadow-lg transition"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <DollarSign size={20} className="text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">{category.name}</h3>
                    <p className="text-2xl font-bold text-green-600 mt-1">
                      ₹{parseFloat(category.amount).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
              
              {category.description && (
                <p className="text-sm text-gray-600 mb-4">{category.description}</p>
              )}
              
              <div className="flex gap-2 pt-3 border-t border-gray-100">
                <button
                  onClick={() => handleEdit(category)}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition text-sm font-medium"
                >
                  <Edit2 size={16} /> Edit
                </button>
                <button
                  onClick={() => handleDelete(category.id)}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition text-sm font-medium"
                >
                  <Trash2 size={16} /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingId(null);
        }}
        title={editingId ? 'Edit Fee Category' : 'Add Fee Category'}
        fields={fields}
        formData={formData}
        onFormChange={(field, value) => setFormData({ ...formData, [field]: value })}
        onSubmit={handleSubmit}
        loading={submitting}
        error={error}
        submitButtonText={editingId ? 'Update Category' : 'Add Category'}
        color="green"
      />
    </div>
  );
}
