import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { generateInvoicePDF } from '../utils/pdfGenerator';
import { FileText, Printer, Eye } from 'lucide-react';

export const InvoiceList: React.FC = () => {
  const invoices = useLiveQuery(() => db.invoices.reverse().toArray());

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-800">Invoice History</h2>
      
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
              <th className="px-6 py-4">Date</th>
              <th className="px-6 py-4">Invoice No</th>
              <th className="px-6 py-4">Party</th>
              <th className="px-6 py-4 text-right">Items</th>
              <th className="px-6 py-4 text-right">Amount</th>
              <th className="px-6 py-4 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {invoices?.map((inv) => (
              <tr key={inv.id} className="hover:bg-slate-50 text-sm">
                <td className="px-6 py-4 text-slate-600">
                  {new Date(inv.date).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 font-mono font-medium text-slate-800">
                  {inv.invoiceNo}
                </td>
                <td className="px-6 py-4 font-medium text-slate-800">
                  {inv.partyName}
                </td>
                <td className="px-6 py-4 text-right text-slate-600">
                  {inv.items.length}
                </td>
                <td className="px-6 py-4 text-right font-bold text-slate-800">
                  ₹{inv.grandTotal.toFixed(2)}
                </td>
                <td className="px-6 py-4 text-center flex justify-center gap-3">
                  <button 
                    onClick={() => generateInvoicePDF(inv)}
                    className="flex items-center text-blue-600 hover:text-blue-800 text-xs font-medium border border-blue-200 rounded px-2 py-1 hover:bg-blue-50"
                  >
                    <Printer className="w-3 h-3 mr-1" /> Print
                  </button>
                </td>
              </tr>
            ))}
            {invoices?.length === 0 && (
              <tr><td colSpan={6} className="text-center py-8 text-slate-500">No invoices generated yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};