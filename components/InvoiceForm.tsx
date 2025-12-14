import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { Party, Product, InvoiceItem, Invoice } from '../types';
import { Search, Plus, Trash2, Save, Printer, AlertCircle, X } from 'lucide-react';
import { generateInvoicePDF } from '../utils/pdfGenerator';
import { useNavigate } from 'react-router-dom';

export const InvoiceForm: React.FC = () => {
  const navigate = useNavigate();
  // State for invoice header
  const [selectedParty, setSelectedParty] = useState<Party | null>(null);
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [invoiceNo, setInvoiceNo] = useState(''); // Would ideally auto-generate

  // State for items
  const [items, setItems] = useState<InvoiceItem[]>([]);
  
  // Search states
  const [partySearch, setPartySearch] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [showPartyDropdown, setShowPartyDropdown] = useState(false);
  const [showProductDropdown, setShowProductDropdown] = useState(false);

  // Queries
  const parties = useLiveQuery(
    () => db.parties
      .filter(p => p.name.toLowerCase().includes(partySearch.toLowerCase()))
      .limit(5)
      .toArray(),
    [partySearch]
  );

  const products = useLiveQuery(
    () => db.products
      .filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()) && p.stock > 0)
      .limit(10)
      .toArray(),
    [productSearch]
  );

  useEffect(() => {
    // Auto-generate invoice number (Simple logic for demo)
    const genId = async () => {
      const count = await db.invoices.count();
      const year = new Date().getFullYear();
      setInvoiceNo(`GD/${year}/${String(count + 1).padStart(3, '0')}`);
    };
    genId();
  }, []);

  const addItem = (product: Product) => {
    // Check if already added
    if (items.find(i => i.id === product.id)) {
      alert('Product already added!');
      return;
    }

    const newItem: InvoiceItem = {
      ...product,
      productId: product.id!,
      quantity: 1,
      discountPercent: 0,
      taxableValue: 0,
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: 0,
      totalAmount: 0,
    };
    
    // Initial calc
    calculateRow(newItem);
    
    setItems([...items, newItem]);
    setShowProductDropdown(false);
    setProductSearch('');
  };

  const calculateRow = (item: InvoiceItem) => {
    // Logic
    // Rate * Qty = Base
    // Base - Discount = Taxable
    // Taxable * GST = Tax Amount
    // Taxable + Tax = Total
    
    const baseAmount = item.saleRate * item.quantity;
    const discountAmount = (baseAmount * item.discountPercent) / 100;
    item.taxableValue = baseAmount - discountAmount;
    
    const taxAmount = (item.taxableValue * item.gstRate) / 100;
    
    // Assuming intra-state for simplicity (split 50-50)
    // Real app would check Party state vs Company state
    item.cgstAmount = taxAmount / 2;
    item.sgstAmount = taxAmount / 2;
    item.igstAmount = 0;
    
    item.totalAmount = item.taxableValue + taxAmount;
    return item;
  };

  const updateItem = (index: number, field: keyof InvoiceItem, value: number) => {
    const newItems = [...items];
    const item = newItems[index];
    (item as any)[field] = value;
    calculateRow(item);
    setItems(newItems);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  // Totals
  const totalTaxable = items.reduce((sum, i) => sum + i.taxableValue, 0);
  const totalCGST = items.reduce((sum, i) => sum + i.cgstAmount, 0);
  const totalSGST = items.reduce((sum, i) => sum + i.sgstAmount, 0);
  const grandTotal = items.reduce((sum, i) => sum + i.totalAmount, 0);

  const handleSave = async () => {
    if (!selectedParty || items.length === 0) {
      alert('Please select a party and add at least one item.');
      return;
    }

    const invoice: Invoice = {
      invoiceNo,
      date: new Date(invoiceDate).toISOString(),
      partyId: selectedParty.id!,
      partyName: selectedParty.name,
      partyGstin: selectedParty.gstin,
      partyAddress: selectedParty.address,
      items: items,
      totalTaxable,
      totalCGST,
      totalSGST,
      totalIGST: 0,
      grandTotal,
      roundOff: 0,
      status: 'PAID',
    };

    try {
      await (db as any).transaction('rw', db.invoices, db.products, async () => {
        await db.invoices.add(invoice);
        // Reduce stock
        for (const item of items) {
          const product = await db.products.get(item.productId);
          if (product) {
            await db.products.update(item.productId, { stock: product.stock - item.quantity });
          }
        }
      });
      
      if (window.confirm('Invoice saved! Generate PDF?')) {
        await generateInvoicePDF(invoice);
      }
      navigate('/invoices');
    } catch (e) {
      console.error(e);
      alert('Error saving invoice');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-800">New Invoice</h2>
        <div className="text-right">
          <p className="text-sm text-slate-500">Invoice #</p>
          <p className="font-mono font-bold text-lg">{invoiceNo}</p>
        </div>
      </div>

      {/* Header Form */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="relative">
          <label className="block text-sm font-medium text-slate-700 mb-1">Select Party</label>
          <div className="relative">
            <input
              type="text"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-blue-500"
              placeholder="Search Party..."
              value={selectedParty ? selectedParty.name : partySearch}
              onChange={(e) => {
                setPartySearch(e.target.value);
                setSelectedParty(null);
                setShowPartyDropdown(true);
              }}
              onFocus={() => setShowPartyDropdown(true)}
            />
            {selectedParty && (
              <button 
                onClick={() => { setSelectedParty(null); setPartySearch(''); }}
                className="absolute right-2 top-2.5 text-slate-400 hover:text-red-500"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          
          {showPartyDropdown && !selectedParty && (
            <div className="absolute z-10 w-full bg-white mt-1 border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {parties?.map(party => (
                <div
                  key={party.id}
                  className="px-4 py-2 hover:bg-blue-50 cursor-pointer text-sm"
                  onClick={() => {
                    setSelectedParty(party);
                    setShowPartyDropdown(false);
                    setPartySearch(party.name);
                  }}
                >
                  <div className="font-medium">{party.name}</div>
                  <div className="text-xs text-slate-500">{party.address}</div>
                </div>
              ))}
              {parties?.length === 0 && <div className="p-2 text-sm text-slate-500">No parties found.</div>}
            </div>
          )}
          
          {selectedParty && (
            <div className="mt-2 text-sm text-slate-600 bg-slate-50 p-2 rounded">
              <p>GSTIN: {selectedParty.gstin}</p>
              <p>Addr: {selectedParty.address}</p>
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Invoice Date</label>
          <input
            type="date"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-blue-500"
            value={invoiceDate}
            onChange={(e) => setInvoiceDate(e.target.value)}
          />
        </div>
      </div>

      {/* Item Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
        <input
          type="text"
          placeholder="Search product to add..."
          className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
          value={productSearch}
          onChange={(e) => { setProductSearch(e.target.value); setShowProductDropdown(true); }}
        />
        {showProductDropdown && productSearch && (
          <div className="absolute z-10 w-full bg-white mt-1 border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
            {products?.map(product => (
              <div
                key={product.id}
                className="px-4 py-3 hover:bg-blue-50 cursor-pointer border-b border-slate-50 last:border-0"
                onClick={() => addItem(product)}
              >
                <div className="flex justify-between">
                  <span className="font-medium text-slate-800">{product.name}</span>
                  <span className="text-sm font-semibold text-blue-600">₹{product.saleRate}</span>
                </div>
                <div className="flex gap-4 text-xs text-slate-500 mt-1">
                  <span>Batch: {product.batch}</span>
                  <span>Exp: {product.expiry}</span>
                  <span className={product.stock < 10 ? 'text-red-500' : 'text-green-600'}>
                    Stock: {product.stock}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Items Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500">
              <tr>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3 w-20">Batch</th>
                <th className="px-4 py-3 w-24">Exp</th>
                <th className="px-4 py-3 w-20 text-right">Qty</th>
                <th className="px-4 py-3 w-24 text-right">Rate</th>
                <th className="px-4 py-3 w-20 text-right">Disc %</th>
                <th className="px-4 py-3 w-24 text-right">Taxable</th>
                <th className="px-4 py-3 w-16 text-right">GST</th>
                <th className="px-4 py-3 w-24 text-right">Total</th>
                <th className="px-4 py-3 w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item, index) => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium">{item.name}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{item.batch}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{item.expiry}</td>
                  <td className="px-4 py-3">
                    <input 
                      type="number" 
                      className="w-full bg-slate-50 border border-slate-200 rounded px-1 py-1 text-right focus:ring-1 focus:ring-blue-500"
                      value={item.quantity}
                      min={1}
                      max={item.stock}
                      onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 0)}
                    />
                  </td>
                  <td className="px-4 py-3 text-right">₹{item.saleRate}</td>
                  <td className="px-4 py-3">
                    <input 
                      type="number" 
                      className="w-full bg-slate-50 border border-slate-200 rounded px-1 py-1 text-right focus:ring-1 focus:ring-blue-500"
                      value={item.discountPercent}
                      min={0}
                      max={100}
                      onChange={(e) => updateItem(index, 'discountPercent', parseFloat(e.target.value) || 0)}
                    />
                  </td>
                  <td className="px-4 py-3 text-right">₹{item.taxableValue.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right text-xs">{item.gstRate}%</td>
                  <td className="px-4 py-3 text-right font-semibold">₹{item.totalAmount.toFixed(2)}</td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => removeItem(index)} className="text-red-400 hover:text-red-600">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-6 py-10 text-center text-slate-400">
                    <div className="flex flex-col items-center">
                      <AlertCircle className="w-8 h-8 mb-2 opacity-50" />
                      Add items to create invoice
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer / Calculations */}
      <div className="flex flex-col md:flex-row justify-between items-start gap-6">
        <div className="w-full md:w-1/2">
           <textarea 
             placeholder="Notes / Remarks"
             className="w-full rounded-xl border-slate-200 shadow-sm focus:ring-blue-500 h-24 p-3 text-sm"
           />
        </div>
        
        <div className="w-full md:w-1/3 bg-slate-900 text-white rounded-xl p-6 shadow-lg">
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-400">Total Taxable</span>
              <span>₹{totalTaxable.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Total CGST</span>
              <span>₹{totalCGST.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Total SGST</span>
              <span>₹{totalSGST.toFixed(2)}</span>
            </div>
            <div className="border-t border-slate-700 pt-3 mt-3 flex justify-between items-center">
              <span className="text-lg font-bold">Grand Total</span>
              <span className="text-2xl font-bold text-green-400">₹{grandTotal.toFixed(2)}</span>
            </div>
          </div>
          
          <button 
            onClick={handleSave}
            className="w-full mt-6 bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-lg flex items-center justify-center transition-colors"
          >
            <Save className="w-5 h-5 mr-2" />
            Save & Print
          </button>
        </div>
      </div>
    </div>
  );
};