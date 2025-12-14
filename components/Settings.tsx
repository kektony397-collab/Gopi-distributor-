import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { db } from '../db';
import { CompanyProfile } from '../types';
import { Save, Building2 } from 'lucide-react';
import { toast } from 'sonner';

export const Settings: React.FC = () => {
  const { register, handleSubmit, setValue, reset } = useForm<CompanyProfile>();

  useEffect(() => {
    const loadSettings = async () => {
      const settings = await db.settings.get(1); // Singleton ID 1
      if (settings) {
        Object.keys(settings).forEach((key) => {
          setValue(key as keyof CompanyProfile, (settings as any)[key]);
        });
      }
    };
    loadSettings();
  }, [setValue]);

  const onSubmit = async (data: CompanyProfile) => {
    try {
      await db.settings.put({ ...data, id: 1 });
      toast.success('Company Profile Updated Successfully');
      // Force reload to update Layout header instantly or use context (Reload is simpler for this architecture)
      setTimeout(() => window.location.reload(), 1000); 
    } catch (error) {
      console.error(error);
      toast.error('Failed to update settings');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center space-x-3 mb-6">
        <div className="p-3 bg-blue-100 rounded-full text-blue-600">
          <Building2 className="w-8 h-8" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Company Settings</h2>
          <p className="text-slate-500 text-sm">Manage your billing profile and invoice details</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="col-span-1 md:col-span-2">
              <label className="block text-sm font-semibold text-slate-700 mb-1">Company Name</label>
              <input {...register('companyName', { required: true })} className="w-full rounded-lg border-slate-300 border px-4 py-2.5 focus:ring-2 focus:ring-blue-500" placeholder="e.g. Gopi Distributors" />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">GSTIN</label>
              <input {...register('gstin')} className="w-full rounded-lg border-slate-300 border px-4 py-2.5 focus:ring-2 focus:ring-blue-500" placeholder="GST Number" />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number</label>
              <input {...register('phone')} className="w-full rounded-lg border-slate-300 border px-4 py-2.5 focus:ring-2 focus:ring-blue-500" />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input {...register('email')} className="w-full rounded-lg border-slate-300 border px-4 py-2.5 focus:ring-2 focus:ring-blue-500" />
            </div>

             <div className="col-span-1 md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Address Line 1</label>
              <input {...register('addressLine1')} className="w-full rounded-lg border-slate-300 border px-4 py-2.5 focus:ring-2 focus:ring-blue-500" />
            </div>

            <div className="col-span-1 md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Address Line 2 (City, State, Zip)</label>
              <input {...register('addressLine2')} className="w-full rounded-lg border-slate-300 border px-4 py-2.5 focus:ring-2 focus:ring-blue-500" />
            </div>

            <div className="col-span-1 md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Invoice Terms & Conditions</label>
              <textarea {...register('terms')} rows={4} className="w-full rounded-lg border-slate-300 border px-4 py-2.5 focus:ring-2 focus:ring-blue-500" placeholder="Terms printed at bottom of invoice..." />
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-100">
            <button type="submit" className="flex items-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 shadow-md transition-all">
              <Save className="w-5 h-5 mr-2" />
              Save Settings
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};