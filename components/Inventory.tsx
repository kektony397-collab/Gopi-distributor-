import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import * as XLSX from 'xlsx';
import { db } from '../db';
import { Product, GSTRate } from '../types';
import { useLiveQuery } from 'dexie-react-hooks';
import { Search, Plus, Upload, Trash2, Edit2, X, Loader2 } from 'lucide-react';
import clsx from 'clsx';
import { toast } from 'sonner';

export const Inventory: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  
  const products = useLiveQuery(
    () => db.products
      .filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.batch.toLowerCase().includes(searchTerm.toLowerCase()))
      .limit(100)
      .toArray(),
    [searchTerm]
  );

  const { register, handleSubmit, reset, setValue } = useForm<Product>();

  useEffect(() => {
    if (editingProduct) {
      Object.keys(editingProduct).forEach((key) => {
        setValue(key as keyof Product, (editingProduct as any)[key]);
      });
    } else {
      reset({
        gstRate: GSTRate.GST_12,
      });
    }
  }, [editingProduct, setValue, reset]);

  const onSubmit = async (data: Product) => {
    try {
      const formattedData = {
        ...data,
        mrp: Number(data.mrp),
        purchaseRate: Number(data.purchaseRate),
        saleRate: Number(data.saleRate),
        stock: Number(data.stock),
        gstRate: Number(data.gstRate),
      };

      if (editingProduct?.id) {
        await db.products.update(editingProduct.id, formattedData);
        toast.success('Product updated successfully');
      } else {
        await db.products.add(formattedData);
        toast.success('Product added successfully');
      }
      setIsModalOpen(false);
      setEditingProduct(null);
      reset();
    } catch (error) {
      console.error("Failed to save product", error);
      toast.error('Error saving product');
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this product?')) {
      await db.products.delete(id);
      toast.success('Product deleted');
    }
  };

  // Advanced Fuzzy Column Matcher for Automatic Recognition
  const getValue = (row: any, keys: string[]): any => {
    const rowKeys = Object.keys(row);
    for (const key of keys) {
      // 1. Exact match
      if (row[key] !== undefined) return row[key];
      
      // 2. Case insensitive match
      const foundKey = rowKeys.find(k => k.toLowerCase().trim() === key.toLowerCase().trim());
      if (foundKey) return row[foundKey];

      // 3. Normalized match (remove special chars)
      const cleanKey = rowKeys.find(k => k.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() === key.replace(/[^a-zA-Z0-9]/g, '').toLowerCase());
      if (cleanKey) return row[cleanKey];
    }
    return undefined;
  };

  const parseNumber = (val: any, defaultVal: number = 0): number => {
    if (!val) return defaultVal;
    if (typeof val === 'number') return val;
    // Remove symbols like ₹, comma, spaces
    const cleanStr = String(val).replace(/[^0-9.-]/g, '');
    const num = parseFloat(cleanStr);
    return isNaN(num) ? defaultVal : num;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        // Parse with header: 1 to get raw array for header inspection if needed, but simple sheet_to_json works well for standard tables
        const data = XLSX.utils.sheet_to_json(ws);

        if (data.length === 0) {
           toast.error('Excel file is empty');
           setIsImporting(false);
           return;
        }

        // Automatic mapping logic
        const productsToAdd: any[] = data.map((row: any) => {
           // Fuzzy match Name
           const name = getValue(row, ['Product Name', 'Name', 'Item Name', 'Description', 'Particulars', 'Item', 'Medicine Name']);
           // Fuzzy match MRP
           const mrpRaw = getValue(row, ['MRP', 'M.R.P.', 'M.R.P', 'Max Price', 'Price']);
           // Fuzzy match Rate
           const rateRaw = getValue(row, ['Rate', 'Purchase Rate', 'P Rate', 'Cost', 'P.Rate', 'Billing Rate']);
           // Fuzzy match Sale Rate (optional, fallback to Rate)
           const saleRateRaw = getValue(row, ['Sale Rate', 'S Rate', 'Selling Price', 'S.Rate']);
           // Fuzzy match Stock
           const stockRaw = getValue(row, ['Stock', 'Qty', 'Quantity', 'Balance', 'Closing Stock', 'Op. Stock']);
           // Fuzzy match Batch
           const batch = getValue(row, ['Batch', 'Batch No', 'BatchNo', 'Lot', 'Lot No']) || 'N/A';
           // Fuzzy match Expiry
           const expiry = getValue(row, ['Expiry', 'Exp', 'Exp Date', 'Expiry Date', 'Valid Upto']) || '2026-01-01';
           
           // Process numbers
           const mrp = parseNumber(mrpRaw, 0);
           const purchaseRate = parseNumber(rateRaw, 0);
           const saleRate = parseNumber(saleRateRaw, 0) || (purchaseRate > 0 ? purchaseRate * 1.2 : mrp); // Fallback logic
           
           // Stock logic: Default to 1 if missing, 0, or negative
           let stock = parseNumber(stockRaw, 0);
           if (stock <= 0) stock = 1;

           return {
             name: String(name || 'Unknown Product').trim(),
             batch: String(batch).trim(),
             expiry: String(expiry).trim(), // Simple string, ideally parse Date
             hsn: String(getValue(row, ['HSN', 'HSN Code', 'HsnCode']) || '3004'),
             gstRate: parseNumber(getValue(row, ['GST', 'GST%', 'Tax', 'Tax Rate', 'IGST']), 12),
             mrp,
             purchaseRate,
             saleRate,
             stock,
             manufacturer: String(getValue(row, ['Manufacturer', 'Mfg', 'Company', 'Brand']) || ''),
           };
        }).filter(p => p.name !== 'Unknown Product'); // Filter out empty rows

        // Bulk Add (Efficiently appends data)
        await db.products.bulkAdd(productsToAdd);
        
        toast.success(`Successfully imported ${productsToAdd.length} products with automatic mapping!`);
      } catch (error) {
        console.error("Import failed", error);
        toast.error('Import failed. Please check file format.');
      } finally {
        setIsImporting(false);
        // Reset file input
        e.target.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-slate-800">Inventory Management</h2>
        <div className="flex gap-2">
          {isImporting ? (
             <div className="flex items-center px-4 py-2 bg-slate-100 rounded-lg text-slate-500">
               <Loader2 className="w-4 h-4 mr-2 animate-spin" />
               Importing...
             </div>
          ) : (
            <label className="btn-secondary cursor-pointer flex items-center px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 shadow-sm transition-all">
              <Upload className="w-4 h-4 mr-2" />
              Import Excel
              <input type="file" accept=".xlsx, .xls, .csv" className="hidden" onChange={handleFileUpload} />
            </label>
          )}
          
          <button 
            onClick={() => { setEditingProduct(null); setIsModalOpen(true); }}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-sm transition-all"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Product
          </button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
        <input
          type="text"
          placeholder="Search by product name or batch..."
          className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white shadow-sm"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <th className="px-6 py-4">Name</th>
                <th className="px-6 py-4">Batch</th>
                <th className="px-6 py-4">Expiry</th>
                <th className="px-6 py-4 text-right">Stock</th>
                <th className="px-6 py-4 text-right">MRP</th>
                <th className="px-6 py-4 text-right">Rate</th>
                <th className="px-6 py-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {products?.map((product) => (
                <tr key={product.id} className="hover:bg-slate-50 transition-colors text-sm">
                  <td className="px-6 py-4 font-medium text-slate-900">{product.name}</td>
                  <td className="px-6 py-4 text-slate-600">{product.batch}</td>
                  <td className="px-6 py-4 text-slate-600">
                    <span className={clsx(
                      new Date(product.expiry) < new Date() ? 'text-red-600 font-bold' : ''
                    )}>
                      {product.expiry}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                     <span className={clsx(
                      "px-2 py-1 rounded-full text-xs font-medium",
                      product.stock < 50 ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
                    )}>
                      {product.stock}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">₹{product.mrp}</td>
                  <td className="px-6 py-4 text-right">₹{product.saleRate}</td>
                  <td className="px-6 py-4 flex justify-center gap-2">
                    <button onClick={() => { setEditingProduct(product); setIsModalOpen(true); }} className="p-1 text-blue-600 hover:bg-blue-50 rounded"><Edit2 className="w-4 h-4" /></button>
                    <button onClick={() => handleDelete(product.id!)} className="p-1 text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
              {products?.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-slate-500">
                    {searchTerm ? "No matching products found." : "No products in inventory. Import Excel file to get started."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b border-slate-100">
              <h3 className="text-xl font-bold text-slate-800">{editingProduct ? 'Edit Product' : 'Add New Product'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Product Name</label>
                  <input {...register('name', { required: true })} className="w-full rounded-lg border-slate-300 border px-3 py-2 focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Manufacturer</label>
                  <input {...register('manufacturer')} className="w-full rounded-lg border-slate-300 border px-3 py-2 focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Batch No</label>
                  <input {...register('batch', { required: true })} className="w-full rounded-lg border-slate-300 border px-3 py-2 focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Expiry (YYYY-MM-DD)</label>
                  <input type="date" {...register('expiry', { required: true })} className="w-full rounded-lg border-slate-300 border px-3 py-2 focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">HSN Code</label>
                  <input {...register('hsn', { required: true })} className="w-full rounded-lg border-slate-300 border px-3 py-2 focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">GST Rate (%)</label>
                  <select {...register('gstRate', { required: true })} className="w-full rounded-lg border-slate-300 border px-3 py-2 focus:ring-2 focus:ring-blue-500">
                    <option value="0">0%</option>
                    <option value="5">5%</option>
                    <option value="12">12%</option>
                    <option value="18">18%</option>
                    <option value="28">28%</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">MRP</label>
                  <input type="number" step="0.01" {...register('mrp', { required: true })} className="w-full rounded-lg border-slate-300 border px-3 py-2 focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Purchase Rate</label>
                  <input type="number" step="0.01" {...register('purchaseRate', { required: true })} className="w-full rounded-lg border-slate-300 border px-3 py-2 focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Sale Rate</label>
                  <input type="number" step="0.01" {...register('saleRate', { required: true })} className="w-full rounded-lg border-slate-300 border px-3 py-2 focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Opening Stock</label>
                  <input type="number" {...register('stock', { required: true })} className="w-full rounded-lg border-slate-300 border px-3 py-2 focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>

              <div className="flex justify-end pt-6">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg mr-2">Cancel</button>
                <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-md">Save Product</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};