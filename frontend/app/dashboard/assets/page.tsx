'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { 
  Box, ArrowUpRight, ArrowDownRight, ClipboardList, AlertCircle, 
  Loader2, Tag, Plus, Search, Filter, ArrowUpDown, ChevronDown, Calendar, Banknote,
  FileText, Upload, ExternalLink 
} from 'lucide-react';
import Modal from '@/components/Modal';

export default function AssetsPage() {
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState<any>({
    name: '',
    cost: '',
    category: '',
    purchased_for: '',
    purchase_date: '',
  });

  // Scheduling State
  const [schedules, setSchedules] = useState<any[]>([]);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleData, setScheduleData] = useState({
    asset: '',
    scheduled_date: '',
    type: 'AUDIT',
    notes: ''
  });

  // Sales State
  const [sales, setSales] = useState<any[]>([]);
  const [showSellModal, setShowSellModal] = useState(false);
  const [sellFormData, setSellFormData] = useState({
    asset: '',
    sale_price: '',
    sale_date: new Date().toISOString().split('T')[0]
  });

  // Search and Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [sortOrder, setSortOrder] = useState<'date_desc' | 'date_asc' | 'name_asc' | 'price_asc' | 'price_desc' | ''>('date_desc');
  const [showFilters, setShowFilters] = useState(false);
  
  // Sales Filter State
  const [saleSearchTerm, setSaleSearchTerm] = useState('');
  const [saleCategoryFilter, setSaleCategoryFilter] = useState('');
  const [saleSortOrder, setSaleSortOrder] = useState<'date_desc' | 'date_asc' | 'name_asc' | 'price_asc' | 'price_desc' | ''>('date_desc');
  const [showSaleFilters, setShowSaleFilters] = useState(false);

  useEffect(() => {
    fetchAssets();
    fetchSchedules();
    fetchSales();
  }, []);

  const fetchSales = async () => {
    try {
      const res = await api.get('/assets/sales/');
      setSales(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchSchedules = async () => {
    try {
      const res = await api.get('/assets/schedules/');
      setSchedules(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAssets = async () => {
    try {
      const res = await api.get('/assets/list/');
      setAssets(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddAsset = async () => {
    setSubmitting(true);
    setError('');
    try {
      const data = { ...formData };
      if (!data.purchase_date) delete data.purchase_date;
      await api.post('/assets/list/', data);
      setShowAddModal(false);
      setFormData({ name: '', cost: '', category: '', purchased_for: '', purchase_date: '' });
      fetchAssets();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to add asset. Please check all fields.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleScheduleEvent = async (type: 'AUDIT' | 'MAINTENANCE') => {
    setSubmitting(true);
    setError('');
    try {
      await api.post('/assets/schedules/', { ...scheduleData, type });
      setShowScheduleModal(false);
      setScheduleData({ asset: '', scheduled_date: '', type: 'AUDIT', notes: '' });
      fetchSchedules();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to schedule event. Please check all fields.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUploadReport = async (eventId: string, file: File) => {
    const formData = new FormData();
    formData.append('report', file);
    try {
      await api.patch(`/assets/schedules/${eventId}/`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      fetchSchedules();
    } catch (err) {
      console.error(err);
      alert('Failed to upload report');
    }
  };

  const handleSellAsset = async () => {
    setSubmitting(true);
    setError('');
    try {
      await api.post('/assets/sales/', sellFormData);
      setShowSellModal(false);
      setSellFormData({ asset: '', sale_price: '', sale_date: new Date().toISOString().split('T')[0] });
      fetchSales();
      fetchAssets();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to record sale. Please check all fields.');
    } finally {
      setSubmitting(false);
    }
  };

  const stats = {
    totalValue: assets.filter(a => a.status !== 'DISPOSED').reduce((acc, a) => acc + parseFloat(a.cost || 0), 0),
    totalCount: assets.length,
    missingReportsCount: schedules.filter(ev => new Date(ev.scheduled_date) < new Date() && !ev.report).length,
    assignedCount: assets.filter(a => a.status === 'ASSIGNED' || a.status === 'IN_USE').length
  };

  const distribution = assets.reduce((acc: any, asset: any) => {
    acc[asset.category] = (acc[asset.category] || 0) + 1;
    return acc;
  }, {});

  const distArray = Object.entries(distribution).map(([name, count]: any) => ({ name, count }));

  const filteredAssets = assets
    .filter(asset => {
      const matchesSearch = asset.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            asset.asset_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            (asset.purchased_for && asset.purchased_for.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesCategory = categoryFilter === '' || asset.category === categoryFilter;
      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => {
      if (!sortOrder) return 0;
      if (sortOrder === 'date_desc') {
        return new Date(b.purchase_date || 0).getTime() - new Date(a.purchase_date || 0).getTime();
      }
      if (sortOrder === 'date_asc') {
        return new Date(a.purchase_date || 0).getTime() - new Date(b.purchase_date || 0).getTime();
      }
      if (sortOrder === 'name_asc') {
        return a.name.localeCompare(b.name);
      }
      const priceA = parseFloat(a.cost || 0);
      const priceB = parseFloat(b.cost || 0);
      return sortOrder === 'price_asc' ? priceA - priceB : priceB - priceA;
    });

  const filteredSales = sales
    .filter(sale => {
      const matchesSearch = sale.asset_name.toLowerCase().includes(saleSearchTerm.toLowerCase());
      const matchesCategory = saleCategoryFilter === '' || sale.asset_category === saleCategoryFilter;
      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => {
      if (!saleSortOrder) return 0;
      if (saleSortOrder === 'date_desc') {
        return new Date(b.sale_date || 0).getTime() - new Date(a.sale_date || 0).getTime();
      }
      if (saleSortOrder === 'date_asc') {
        return new Date(a.sale_date || 0).getTime() - new Date(b.sale_date || 0).getTime();
      }
      if (saleSortOrder === 'name_asc') {
        return a.asset_name.localeCompare(b.asset_name);
      }
      const priceA = parseFloat(a.sale_price || 0);
      const priceB = parseFloat(b.sale_price || 0);
      return saleSortOrder === 'price_asc' ? priceA - priceB : priceB - priceA;
    });

  const salesStats = {
    totalSold: filteredSales.length,
    netProfitLoss: filteredSales.reduce((acc, s) => acc + (parseFloat(s.profit_loss) || 0), 0)
  };

  const categories = [
    { value: 'Fixed Tangible Assets', label: 'Fixed Tangible Assets' },
    { value: 'ICT and IT Equipment', label: 'ICT and IT Equipment' },
    { value: 'Educational Resources and Specialized Equipment', label: 'Educational Resources and Specialized Equipment' },
    { value: 'Inventory and Consumables', label: 'Inventory and Consumables' },
    { value: 'Intangible and Software assets', label: 'Intangible and Software assets' },
  ];

  const fields: any[] = [
    { name: 'name', label: 'Name of Asset', type: 'text', required: true, placeholder: 'e.g. Science Lab Microscope' },
    { name: 'cost', label: 'Price of the Asset (₹)', type: 'number', required: true, placeholder: '0.00' },
    { name: 'category', label: 'Asset Category', type: 'select', required: true, options: categories },
    { name: 'purchased_for', label: 'Purchased for', type: 'text', required: true, placeholder: 'e.g. Science Department' },
    { name: 'purchase_date', label: 'Purchase Date', type: 'date', required: false },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">📦 Asset Management</h1>
          <p className="text-slate-500 font-medium">Track school inventory, consumables, and fixed assets.</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setShowScheduleModal(true)}
            className="bg-slate-100 text-slate-900 px-6 py-2.5 rounded-xl font-bold hover:bg-slate-200 transition flex items-center gap-2"
          >
            <ClipboardList size={18} /> Audit
          </button>
          <button 
            onClick={() => setShowSellModal(true)}
            className="bg-amber-100 text-amber-900 px-6 py-2.5 rounded-xl font-bold hover:bg-amber-200 transition flex items-center gap-2"
          >
            <Banknote size={18} /> Sell Assets
          </button>
          <button 
            onClick={() => setShowAddModal(true)}
            className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-blue-700 transition shadow-lg shadow-blue-100 flex items-center gap-2"
          >
            <Plus size={18} /> Add Asset
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { 
            label: 'Inventory Value', 
            value: `₹${(stats.totalValue / 1000).toFixed(1)}k`, 
            icon: Box, 
            trend: 'up', 
            trendValue: '12.5%',
            color: 'text-blue-600', 
            bg: 'bg-blue-50' 
          },
          { 
            label: 'Total Items bought', 
            value: stats.totalCount, 
            icon: ClipboardList, 
            trend: 'none', 
            color: 'text-slate-600', 
            bg: 'bg-slate-50' 
          },
          { 
            label: 'Currently Assigned', 
            value: stats.assignedCount, 
            icon: Tag, 
            trend: stats.totalCount > 0 ? (stats.assignedCount / stats.totalCount > 0.5 ? 'up' : 'down') : 'none',
            trendValue: stats.totalCount > 0 ? `${((stats.assignedCount / stats.totalCount) * 100).toFixed(1)}%` : '0%',
            color: 'text-amber-600', 
            bg: 'bg-amber-50' 
          },
          { 
            label: 'Missing Reports', 
            value: stats.missingReportsCount, 
            icon: AlertCircle, 
            trend: 'none', 
            color: 'text-red-600', 
            bg: 'bg-red-50' 
          },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all ring-1 ring-slate-100">
            <div className="flex justify-between items-start mb-4">
               <div className={`p-3 ${stat.bg} ${stat.color} rounded-xl shadow-inner`}>
                 <stat.icon size={24} />
               </div>
               {stat.trend !== 'none' && (
                 <span className={`text-[10px] ${stat.trend === 'up' ? 'text-green-600 bg-green-50' : 'text-amber-600 bg-amber-50'} font-black flex items-center gap-1 px-2 py-1 rounded-full`}>
                   {stat.trend === 'up' ? <ArrowUpRight size={12}/> : <ArrowDownRight size={12}/>} 
                   {stat.trendValue}
                 </span>
               )}
            </div>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">{stat.label}</p>
            <p className="text-2xl font-black text-slate-900">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
         <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm ring-1 ring-slate-100 flex flex-col">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
              <h3 className="font-bold text-xl text-slate-900">Recent Procurement</h3>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-48">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                    type="text" 
                    placeholder="Search..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                  />
                </div>
                <div className="relative">
                  <button 
                    onClick={() => setShowFilters(!showFilters)}
                    className={`p-2 rounded-xl border transition-all ${showFilters || categoryFilter || sortOrder ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-slate-50 border-slate-100 text-slate-500 hover:bg-slate-100'}`}
                  >
                    <Filter size={18} />
                  </button>
                  
                  {showFilters && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setShowFilters(false)}></div>
                      <div className="absolute right-0 mt-2 w-64 bg-white border border-slate-200 rounded-2xl shadow-xl z-20 p-4 animate-in fade-in zoom-in duration-200">
                        <div className="space-y-4">
                          <div>
                            <p className="text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">Filter by Category</p>
                            <select 
                              value={categoryFilter}
                              onChange={(e) => setCategoryFilter(e.target.value)}
                              className="w-full p-2 bg-slate-50 border border-slate-100 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="">All Categories</option>
                              {categories.map(cat => <option key={cat.value} value={cat.value}>{cat.label}</option>)}
                            </select>
                          </div>
                          <div>
                            <p className="text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">Sort Assets</p>
                            <div className="grid grid-cols-1 gap-2">
                              <div className="flex gap-2">
                                <button 
                                  onClick={() => setSortOrder(sortOrder === 'date_desc' ? '' : 'date_desc')}
                                  className={`flex-1 py-2 px-3 rounded-lg border text-[10px] font-black transition-all ${sortOrder === 'date_desc' ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-100' : 'bg-slate-50 border-slate-100 text-slate-600'}`}
                                >
                                  RECENT TO OLDEST
                                </button>
                                <button 
                                  onClick={() => setSortOrder(sortOrder === 'date_asc' ? '' : 'date_asc')}
                                  className={`flex-1 py-2 px-3 rounded-lg border text-[10px] font-black transition-all ${sortOrder === 'date_asc' ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-100' : 'bg-slate-50 border-slate-100 text-slate-600'}`}
                                >
                                  OLDEST TO RECENT
                                </button>
                              </div>
                              <button 
                                onClick={() => setSortOrder(sortOrder === 'name_asc' ? '' : 'name_asc')}
                                className={`w-full py-2 px-3 rounded-lg border text-[10px] font-black transition-all ${sortOrder === 'name_asc' ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-100' : 'bg-slate-50 border-slate-100 text-slate-600'}`}
                              >
                                ALPHABETICAL (A-Z)
                              </button>
                              <div className="flex gap-2 mt-2 pt-2 border-t border-slate-100">
                                <button 
                                  onClick={() => setSortOrder(sortOrder === 'price_asc' ? '' : 'price_asc')}
                                  className={`flex-1 py-2 px-3 rounded-lg border text-[10px] font-black transition-all ${sortOrder === 'price_asc' ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-100' : 'bg-slate-50 border-slate-100 text-slate-600'}`}
                                >
                                  PRICE: LOW TO HIGH
                                </button>
                                <button 
                                  onClick={() => setSortOrder(sortOrder === 'price_desc' ? '' : 'price_desc')}
                                  className={`flex-1 py-2 px-3 rounded-lg border text-[10px] font-black transition-all ${sortOrder === 'price_desc' ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-100' : 'bg-slate-50 border-slate-100 text-slate-600'}`}
                                >
                                  PRICE: HIGH TO LOW
                                </button>
                              </div>
                            </div>
                          </div>
                          <button 
                            onClick={() => { setCategoryFilter(''); setSortOrder(''); setShowFilters(false); }}
                            className="w-full py-2 text-[10px] font-black text-slate-400 hover:text-red-500 transition-colors uppercase tracking-widest pt-2 border-t border-slate-50"
                          >
                            Reset Filters
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="space-y-4 flex-1 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
               {loading ? (
                  [1, 2, 3].map(i => <div key={i} className="h-16 bg-slate-50 rounded-2xl animate-pulse" />)
               ) : filteredAssets.length === 0 ? (
                 <div className="flex flex-col items-center justify-center py-12 text-slate-400 space-y-4">
                    <Box size={48} strokeWidth={1.5} />
                    <p className="font-medium italic">
                      {searchTerm || categoryFilter ? "No matches found." : "No assets registered yet."}
                    </p>
                    {!(searchTerm || categoryFilter) && (
                      <button 
                        onClick={() => setShowAddModal(true)}
                        className="text-blue-600 text-sm font-bold hover:underline"
                      >
                        Add your first asset
                      </button>
                    )}
                 </div>
               ) : (
                 filteredAssets.map((item, i) => (
                    <div key={i} className="group flex justify-between items-center p-4 bg-slate-50 hover:bg-blue-50/50 rounded-2xl border border-slate-100 hover:border-blue-200 transition-all cursor-pointer">
                       <div className="flex items-center gap-3">
                         <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-slate-400 group-hover:text-blue-500 transition-colors shadow-sm">
                           <Box size={20} />
                         </div>
                         <div>
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-slate-900 text-sm group-hover:text-blue-700 transition-colors">{item.name}</p>
                              {item.status !== 'DISPOSED' && (
                                <span className="text-[8px] font-black bg-green-100 text-green-700 px-1.5 py-0.5 rounded uppercase tracking-wider">Available</span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <p className="text-[10px] text-slate-500 font-medium uppercase tracking-tight">{item.asset_code} • {item.category}</p>
                              <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                              <p className="text-[10px] text-blue-600 font-bold uppercase tracking-tight">{item.purchased_for}</p>
                            </div>
                         </div>
                       </div>
                       <div className="text-right">
                         <p className="font-black text-sm text-slate-900">₹{parseFloat(item.cost).toLocaleString()}</p>
                         <p className="text-[10px] text-slate-400 font-bold">{item.purchase_date}</p>
                       </div>
                    </div>
                 ))
               )}
            </div>
         </div>

         <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm ring-1 ring-slate-100 flex flex-col">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
              <h3 className="font-bold text-xl text-slate-900">Asset Sales</h3>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-48">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                    type="text" 
                    placeholder="Search sales..." 
                    value={saleSearchTerm}
                    onChange={(e) => setSaleSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition-all"
                  />
                </div>
                <div className="relative">
                  <button 
                    onClick={() => setShowSaleFilters(!showSaleFilters)}
                    className={`p-2 rounded-xl border transition-all ${showSaleFilters || saleCategoryFilter || saleSortOrder ? 'bg-amber-50 border-amber-200 text-amber-600' : 'bg-slate-50 border-slate-100 text-slate-500 hover:bg-slate-100'}`}
                  >
                    <Filter size={18} />
                  </button>
                  
                  {showSaleFilters && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setShowSaleFilters(false)}></div>
                      <div className="absolute right-0 mt-2 w-64 bg-white border border-slate-200 rounded-2xl shadow-xl z-20 p-4 animate-in fade-in zoom-in duration-200">
                        <div className="space-y-4">
                          <div>
                            <p className="text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">Filter by Category</p>
                            <select 
                              value={saleCategoryFilter}
                              onChange={(e) => setSaleCategoryFilter(e.target.value)}
                              className="w-full p-2 bg-slate-50 border border-slate-100 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-amber-500"
                            >
                              <option value="">All Categories</option>
                              {categories.map(cat => <option key={cat.value} value={cat.value}>{cat.label}</option>)}
                            </select>
                          </div>
                          <div>
                            <p className="text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">Sort Sales</p>
                            <div className="grid grid-cols-1 gap-2">
                              <div className="flex gap-2">
                                <button 
                                  onClick={() => setSaleSortOrder(saleSortOrder === 'date_desc' ? '' : 'date_desc')}
                                  className={`flex-1 py-2 px-3 rounded-lg border text-[10px] font-black transition-all ${saleSortOrder === 'date_desc' ? 'bg-amber-600 border-amber-600 text-white shadow-lg shadow-amber-100' : 'bg-slate-50 border-slate-100 text-slate-600'}`}
                                >
                                  RECENT TO OLDEST
                                </button>
                                <button 
                                  onClick={() => setSaleSortOrder(saleSortOrder === 'date_asc' ? '' : 'date_asc')}
                                  className={`flex-1 py-2 px-3 rounded-lg border text-[10px] font-black transition-all ${saleSortOrder === 'date_asc' ? 'bg-amber-600 border-amber-600 text-white shadow-lg shadow-amber-100' : 'bg-slate-50 border-slate-100 text-slate-600'}`}
                                >
                                  OLDEST TO RECENT
                                </button>
                              </div>
                              <button 
                                onClick={() => setSaleSortOrder(saleSortOrder === 'name_asc' ? '' : 'name_asc')}
                                className={`w-full py-2 px-3 rounded-lg border text-[10px] font-black transition-all ${saleSortOrder === 'name_asc' ? 'bg-amber-600 border-amber-600 text-white shadow-lg shadow-amber-100' : 'bg-slate-50 border-slate-100 text-slate-600'}`}
                              >
                                ALPHABETICAL (A-Z)
                              </button>
                              <div className="flex gap-2 mt-2 pt-2 border-t border-slate-100">
                                <button 
                                  onClick={() => setSaleSortOrder(saleSortOrder === 'price_asc' ? '' : 'price_asc')}
                                  className={`flex-1 py-2 px-3 rounded-lg border text-[10px] font-black transition-all ${saleSortOrder === 'price_asc' ? 'bg-amber-600 border-amber-600 text-white shadow-lg shadow-amber-100' : 'bg-slate-50 border-slate-100 text-slate-600'}`}
                                >
                                  PRICE: LOW TO HIGH
                                </button>
                                <button 
                                  onClick={() => setSaleSortOrder(saleSortOrder === 'price_desc' ? '' : 'price_desc')}
                                  className={`flex-1 py-2 px-3 rounded-lg border text-[10px] font-black transition-all ${saleSortOrder === 'price_desc' ? 'bg-amber-600 border-amber-600 text-white shadow-lg shadow-amber-100' : 'bg-slate-50 border-slate-100 text-slate-600'}`}
                                >
                                  PRICE: HIGH TO LOW
                                </button>
                              </div>
                            </div>
                          </div>
                          <button 
                            onClick={() => { setSaleCategoryFilter(''); setSaleSortOrder(''); setShowSaleFilters(false); }}
                            className="w-full py-2 text-[10px] font-black text-slate-400 hover:text-red-500 transition-colors uppercase tracking-widest pt-2 border-t border-slate-50"
                          >
                            Reset Filters
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Sold</p>
                <p className="text-xl font-black text-slate-900">{salesStats.totalSold}</p>
              </div>
              <div className={`p-4 rounded-2xl border ${salesStats.netProfitLoss >= 0 ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
                <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${salesStats.netProfitLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>Net Profit/Loss</p>
                <p className={`text-xl font-black ${salesStats.netProfitLoss >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                  {salesStats.netProfitLoss >= 0 ? '+' : '-'}₹{Math.abs(salesStats.netProfitLoss).toLocaleString()}
                </p>
              </div>
            </div>

            <div className="space-y-4 flex-1 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
               {loading ? (
                  [1, 2].map(i => <div key={i} className="h-16 bg-slate-50 rounded-2xl animate-pulse" />)
               ) : filteredSales.length === 0 ? (
                 <div className="flex flex-col items-center justify-center py-12 text-slate-400 space-y-4">
                    <Banknote size={48} strokeWidth={1.5} />
                    <p className="font-medium italic text-sm">No sales matching criteria.</p>
                 </div>
               ) : (
                 filteredSales.map((sale, i) => (
                    <div key={i} className="group flex justify-between items-center p-4 bg-slate-50 hover:bg-amber-50/50 rounded-2xl border border-slate-100 hover:border-amber-200 transition-all cursor-pointer">
                       <div className="flex items-center gap-3">
                         <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-slate-400 group-hover:text-amber-500 transition-colors shadow-sm">
                           <Banknote size={20} />
                         </div>
                         <div>
                            <p className="font-bold text-slate-900 text-sm">{sale.asset_name}</p>
                            <div className="flex items-center gap-2">
                              <p className="text-[10px] text-slate-400 font-bold uppercase">{sale.sale_date}</p>
                              <span className="text-[8px] font-bold bg-slate-200 text-slate-600 px-1 py-0.5 rounded uppercase">{sale.asset_category}</span>
                            </div>
                         </div>
                       </div>
                       <div className="text-right">
                         <p className="font-black text-sm text-slate-900">₹{parseFloat(sale.sale_price).toLocaleString()}</p>
                         <p className={`text-[10px] font-bold uppercase tracking-widest ${sale.profit_loss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                           {sale.profit_loss >= 0 ? `+₹${parseFloat(sale.profit_loss).toLocaleString()}` : `-₹${Math.abs(parseFloat(sale.profit_loss)).toLocaleString()}`}
                         </p>
                       </div>
                    </div>
                 ))
               )}
            </div>
         </div>
      </div>

       <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
          {/* Past Events & Reports Card */}
          <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm ring-1 ring-slate-100 flex flex-col">
            <h3 className="font-bold text-xl text-slate-900 mb-8 flex items-center gap-2">
              <FileText size={24} className="text-amber-600" />
              Past Events & Reports
            </h3>
            <div className="space-y-4 flex-1 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
              {schedules.filter(ev => new Date(ev.scheduled_date) < new Date()).length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400 space-y-4">
                  <FileText size={48} strokeWidth={1.5} />
                  <p className="font-medium italic text-sm">No past events recorded.</p>
                </div>
              ) : (
                schedules.filter(ev => new Date(ev.scheduled_date) < new Date()).map((ev, i) => (
                  <div key={i} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 group hover:border-amber-200 transition-all">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="text-xs font-black text-slate-900">{ev.asset_name}</p>
                        <p className={`text-[10px] font-bold uppercase tracking-tighter ${ev.type === 'AUDIT' ? 'text-purple-600' : 'text-blue-600'}`}>
                          {ev.type} • {ev.asset_category}
                        </p>
                        <p className="text-[10px] font-black text-slate-500 mt-1">{ev.scheduled_date}</p>
                      </div>
                      <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase ${ev.report ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                        {ev.report ? 'Report Uploaded' : 'Missing Report'}
                      </span>
                    </div>
                    
                    <div className="flex gap-2">
                      {ev.report ? (
                        <a 
                          href={ev.report} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex-1 py-2 bg-white border border-slate-200 rounded-lg text-[9px] font-black uppercase text-slate-600 hover:bg-slate-50 flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <ExternalLink size={12} /> View Report
                        </a>
                      ) : (
                        <label className="flex-1 py-2 bg-white border border-slate-200 rounded-lg text-[9px] font-black uppercase text-slate-400 cursor-pointer hover:bg-slate-50 flex items-center justify-center gap-1.5 transition-colors">
                          <Upload size={12} /> Upload PDF
                          <input 
                            type="file" 
                            accept=".pdf" 
                            className="hidden" 
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleUploadReport(ev.id, file);
                            }}
                          />
                        </label>
                      )}
                      {ev.report && (
                         <label className="p-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-400 cursor-pointer hover:bg-slate-200 transition-colors">
                            <Upload size={12} />
                            <input 
                              type="file" 
                              accept=".pdf" 
                              className="hidden" 
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleUploadReport(ev.id, file);
                              }}
                            />
                         </label>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Asset Distribution Card */}
          <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm ring-1 ring-slate-100">
             <h3 className="font-bold text-xl text-slate-900 mb-8">Asset Distribution</h3>
             <div className="space-y-6">
                {loading ? (
                  <div className="h-48 flex items-center justify-center"><Loader2 className="animate-spin text-blue-600" /></div>
                ) : distArray.length === 0 ? (
                  <div className="h-48 flex items-center justify-center text-slate-300 italic">No data available</div>
                ) : (
                  distArray.map((item: any, i: number) => (
                    <div key={i} className="space-y-2">
                      <div className="flex justify-between text-xs font-bold uppercase tracking-widest text-slate-500">
                        <span>{item.name || 'Other'}</span>
                        <span className="text-blue-600">{item.count} Items</span>
                      </div>
                      <div className="h-3 w-full bg-slate-50 rounded-full overflow-hidden shadow-inner">
                        <div 
                          className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full shadow-lg" 
                          style={{ width: `${(item.count / stats.totalCount) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}
             </div>

             <div className="mt-12 pt-8 border-t border-slate-100">
                <h3 className="font-bold text-lg text-slate-900 mb-6 flex items-center gap-2">
                  <Calendar size={20} className="text-blue-600" />
                  Upcoming Schedule
                </h3>
                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                  {schedules.filter(ev => new Date(ev.scheduled_date) >= new Date()).length === 0 ? (
                    <p className="text-xs text-slate-400 italic py-4">No upcoming audits or maintenance.</p>
                  ) : (
                    schedules.filter(ev => new Date(ev.scheduled_date) >= new Date()).map((ev, i) => (
                      <div key={i} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex justify-between items-center group hover:border-blue-200 transition-all">
                        <div>
                          <p className="text-xs font-black text-slate-900">{ev.asset_name}</p>
                          <p className={`text-[10px] font-bold uppercase tracking-tighter ${ev.type === 'AUDIT' ? 'text-purple-600' : 'text-blue-600'}`}>
                            {ev.type} • {ev.asset_category}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-black text-slate-900">{ev.scheduled_date}</p>
                          <p className={`text-[9px] text-slate-400 font-bold uppercase tracking-widest ${ev.status === 'SCHEDULED' ? 'text-blue-600 bg-blue-50' : 'text-green-600 bg-green-50'} px-2 py-1 rounded-full`}>{ev.status}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
             </div>

             <div className={`mt-8 p-6 ${schedules.filter(ev => new Date(ev.scheduled_date) >= new Date()).length > 0 ? 'bg-amber-50 border-amber-100' : 'bg-slate-50 border-slate-100'} rounded-2xl border flex items-start gap-4 transition-colors`}>
               <AlertCircle className={schedules.filter(ev => new Date(ev.scheduled_date) >= new Date()).length > 0 ? 'text-amber-600' : 'text-slate-400'} size={24} />
               <div>
                 <p className={`font-bold ${schedules.filter(ev => new Date(ev.scheduled_date) >= new Date()).length > 0 ? 'text-amber-900' : 'text-slate-500'} text-sm`}>
                   {schedules.filter(ev => new Date(ev.scheduled_date) >= new Date()).length > 0 ? 'Upcoming Schedule' : 'System Healthy'}
                 </p>
                 <p className={`text-xs ${schedules.filter(ev => new Date(ev.scheduled_date) >= new Date()).length > 0 ? 'text-amber-700' : 'text-slate-400'} font-medium leading-relaxed mt-1`}>
                   {schedules.filter(ev => new Date(ev.scheduled_date) >= new Date()).length > 0 
                     ? `You have ${schedules.filter(ev => new Date(ev.scheduled_date) >= new Date()).length} upcoming audit${schedules.filter(ev => new Date(ev.scheduled_date) >= new Date()).length > 1 ? 's' : ''}/maintenance scheduled.`
                     : "Regular maintenance checks will appear here once scheduled."}
                 </p>
               </div>
             </div>
          </div>
       </div>

      <Modal
        isOpen={showScheduleModal}
        onClose={() => setShowScheduleModal(false)}
        title="🗓️ Schedule Audit / Maintenance"
        error={error}
      >
        <div className="space-y-8">
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
            <h4 className="font-black text-xs uppercase tracking-widest text-slate-400">Common Details</h4>
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Asset Name (Available Only)</label>
                <select 
                  value={scheduleData.asset}
                  onChange={(e) => setScheduleData({ ...scheduleData, asset: e.target.value })}
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                >
                  <option value="">Select Asset</option>
                  {assets.filter(a => a.status !== 'DISPOSED').map(a => (
                    <option key={a.id} value={a.id}>{a.name} ({a.category})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Schedule Date</label>
                <input 
                  type="date" 
                  value={scheduleData.scheduled_date}
                  onChange={(e) => setScheduleData({ ...scheduleData, scheduled_date: e.target.value })}
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2">
            <div className="space-y-3">
              <div className="p-3 bg-purple-50 rounded-2xl border border-purple-100 text-center">
                <ClipboardList className="mx-auto text-purple-600 mb-2" size={24} />
                <p className="text-[10px] font-black text-purple-900 uppercase">Audit Section</p>
              </div>
              <button 
                onClick={() => handleScheduleEvent('AUDIT')}
                disabled={submitting || !scheduleData.asset || !scheduleData.scheduled_date}
                className="w-full py-3 bg-purple-600 text-white rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-purple-700 transition disabled:bg-slate-300 disabled:shadow-none shadow-lg shadow-purple-100 flex items-center justify-center gap-2"
              >
                {submitting ? <Loader2 className="animate-spin" size={14} /> : 'Schedule Audit'}
              </button>
            </div>
            <div className="space-y-3">
              <div className="p-3 bg-blue-50 rounded-2xl border border-blue-100 text-center">
                <Tag className="mx-auto text-blue-600 mb-2" size={24} />
                <p className="text-[10px] font-black text-blue-900 uppercase">Maintenance Section</p>
              </div>
              <button 
                onClick={() => handleScheduleEvent('MAINTENANCE')}
                disabled={submitting || !scheduleData.asset || !scheduleData.scheduled_date}
                className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-blue-700 transition disabled:bg-slate-300 disabled:shadow-none shadow-lg shadow-blue-100 flex items-center justify-center gap-2"
              >
                {submitting ? <Loader2 className="animate-spin" size={14} /> : 'Schedule Maintenance'}
              </button>
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showSellModal}
        onClose={() => setShowSellModal(false)}
        title="💰 Sell Asset"
        error={error}
      >
        <div className="space-y-6">
          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Asset Name</label>
              <select 
                value={sellFormData.asset}
                onChange={(e) => setSellFormData({ ...sellFormData, asset: e.target.value })}
                className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition-all shadow-sm"
              >
                <option value="">Select Asset to Sell</option>
                {assets.filter(a => a.status !== 'DISPOSED').map(a => (
                  <option key={a.id} value={a.id}>{a.name} ({a.category})</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Sold for (₹)</label>
                <input 
                  type="number" 
                  placeholder="0.00"
                  value={sellFormData.sale_price}
                  onChange={(e) => setSellFormData({ ...sellFormData, sale_price: e.target.value })}
                  className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition-all shadow-sm"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Date Sold</label>
                <input 
                  type="date" 
                  value={sellFormData.sale_date}
                  onChange={(e) => setSellFormData({ ...sellFormData, sale_date: e.target.value })}
                  className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition-all shadow-sm"
                />
              </div>
            </div>
          </div>
          <button 
            onClick={handleSellAsset}
            disabled={submitting || !sellFormData.asset || !sellFormData.sale_price}
            className="w-full py-4 bg-amber-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-amber-700 transition shadow-lg shadow-amber-100 disabled:bg-slate-300 disabled:shadow-none flex items-center justify-center gap-2"
          >
            {submitting ? <Loader2 className="animate-spin" size={16} /> : 'Confirm Sale'}
          </button>
        </div>
      </Modal>

      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="✨ Add New Asset"
        fields={fields}
        formData={formData}
        onFormChange={(name, value) => setFormData({ ...formData, [name]: value })}
        onSubmit={handleAddAsset}
        loading={submitting}
        error={error}
        submitButtonText="Add Asset"
        color="blue"
      />
    </div>
  );
}
