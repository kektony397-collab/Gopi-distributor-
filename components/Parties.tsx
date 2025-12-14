import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { db } from '../db';
import { Party } from '../types';
import { useLiveQuery } from 'dexie-react-hooks';
import { Search, Plus, Upload, Trash2, Edit2, X, Phone, MapPin } from 'lucide-react';
import * as XLSX from 'xlsx';

export const Parties: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingParty, setEditingParty] = useState<Party | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const parties = useLiveQuery(
    () => db.parties
      .filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()))
      .toArray(),
    [searchTerm]
  );

  const { register, handleSubmit, reset, setValue } = useForm<Party>();

  React.useEffect(() => {
    if (editingParty) {
      Object.keys(editingParty).forEach((key) => {
        setValue(key as keyof Party, (editingParty as any)[key]);
      });
    } else {
      reset();
    }
  }, [editingParty, setValue, reset]);

  const onSubmit = async (data: Party) => {
    try {
      if (editingParty?.id) {
        await db.parties.update(editingParty.id, data);
      } else {
        await db.parties.add(data);
      }
      setIsModalOpen(false);
      setEditingParty(null);
      reset();
    } catch (error) {
      console.error(error);
      alert('Error saving party');
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Delete this party?')) {
      await db.parties.delete(id);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(ws);
      const partiesToAdd: any[] = data.map((row: any) => ({
        name: row['Name'],
        gstin: row['GSTIN'] || '',
        address: row['Address'] || '',
        phone: row['Phone'] || '',
        email: row['Email'] || '',
      }));
      await db.parties.bulkAdd(partiesToAdd);
      alert(`Imported ${partiesToAdd.length} parties.`);
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className="space-y-6">
       <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-slate-800">Parties (Customers)</h2>
        <div className="flex gap-2">
          <label className="btn-secondary cursor-pointer flex items-center px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 shadow-sm transition-all">
            <Upload className="w-4 h-4 mr-2" />
            Import Excel
             <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleFileUpload} />
          </label>
          <button 
            onClick={() => { setEditingParty(null); setIsModalOpen(true); }}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-sm transition-all"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Party
          </button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
        <input
          type="text"
          placeholder="Search parties..."
          className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-sm"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {parties?.map((party) => (
          <div key={party.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <h3 className="font-bold text-lg text-slate-800">{party.name}</h3>
              <div className="flex gap-1">
                 <button onClick={() => { setEditingParty(party); setIsModalOpen(true); }} className="p-1 text-blue-600 hover:bg-blue-50 rounded"><Edit2 className="w-4 h-4" /></button>
                 <button onClick={() => handleDelete(party.id!)} className="p-1 text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
            <div className="space-y-2 text-sm text-slate-600">
              {party.gstin && <p className="font-mono bg-slate-100 inline-block px-2 py-0.5 rounded text-xs">GST: {party.gstin}</p>}
              <div className="flex items-center">
                <Phone className="w-4 h-4 mr-2 text-slate-400" />
                {party.phone || 'N/A'}
              </div>
              <div className="flex items-start">
                <MapPin className="w-4 h-4 mr-2 text-slate-400 mt-0.5" />
                <span className="flex-1">{party.address || 'No Address'}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

       {/* Modal */}
       {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
              <h3 className="text-xl font-bold text-slate-800">{editingParty ? 'Edit Party' : 'Add Party'}</h3>
              <button onClick={() => setIsModalOpen(false)}><X className="w-6 h-6 text-slate-400" /></button>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <input {...register('name', { required: true })} placeholder="Party Name" className="w-full rounded-lg border border-slate-300 px-3 py-2" />
              <input {...register('gstin')} placeholder="GSTIN" className="w-full rounded-lg border border-slate-300 px-3 py-2" />
              <input {...register('phone')} placeholder="Phone" className="w-full rounded-lg border border-slate-300 px-3 py-2" />
              <textarea {...register('address')} placeholder="Address" className="w-full rounded-lg border border-slate-300 px-3 py-2" rows={3} />
              <input {...register('dlNo')} placeholder="Drug License No" className="w-full rounded-lg border border-slate-300 px-3 py-2" />
              
              <div className="flex justify-end pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="mr-3 text-slate-600">Cancel</button>
                <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};