export enum GSTRate {
  GST_0 = 0,
  GST_5 = 5,
  GST_12 = 12,
  GST_18 = 18,
  GST_28 = 28,
}

export interface CompanyProfile {
  id?: number;
  companyName: string;
  addressLine1: string;
  addressLine2: string;
  gstin: string;
  dlNo1: string; // Drug License 1
  dlNo2: string; // Drug License 2
  phone: string;
  email: string;
  terms: string;
}

export interface Product {
  id?: number;
  name: string;
  batch: string;
  expiry: string; // YYYY-MM-DD
  hsn: string;
  gstRate: number;
  mrp: number;
  purchaseRate: number;
  saleRate: number;
  stock: number;
  manufacturer?: string;
}

export interface Party {
  id?: number;
  name: string;
  gstin: string;
  address: string;
  phone: string;
  email?: string;
  dlNo?: string; // Drug License No
}

export interface InvoiceItem extends Product {
  productId: number;
  quantity: number;
  discountPercent: number;
  taxableValue: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalAmount: number;
}

export interface Invoice {
  id?: number;
  invoiceNo: string;
  date: string; // ISO String
  partyId: number;
  partyName: string;
  partyGstin: string;
  partyAddress: string;
  items: InvoiceItem[];
  totalTaxable: number;
  totalCGST: number;
  totalSGST: number;
  totalIGST: number;
  grandTotal: number;
  roundOff: number;
  status: 'PAID' | 'PENDING' | 'CANCELLED';
}

export interface DashboardStats {
  totalSales: number;
  totalInvoices: number;
  lowStockItems: number;
  expiringSoonItems: number;
}