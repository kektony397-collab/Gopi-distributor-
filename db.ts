import Dexie, { Table } from 'dexie';
import { Product, Party, Invoice, CompanyProfile } from './types';

export class AppDatabase extends Dexie {
  products!: Table<Product>;
  parties!: Table<Party>;
  invoices!: Table<Invoice>;
  settings!: Table<CompanyProfile>;

  constructor() {
    super('GopiDistributorsDB');
    (this as any).version(1).stores({
      products: '++id, name, hsn, batch', // Indexed fields
      parties: '++id, name, gstin',
      invoices: '++id, invoiceNo, date, partyId',
      settings: '++id'
    });
  }
}

export const db = new AppDatabase();

// Seed initial data if empty
export const seedDatabase = async () => {
  const productCount = await db.products.count();
  if (productCount === 0) {
    await db.products.bulkAdd([
      { name: 'Paracetamol 500mg', batch: 'B123', expiry: '2026-12-31', hsn: '3004', gstRate: 12, mrp: 20, purchaseRate: 10, saleRate: 15, stock: 1000, manufacturer: 'Cipla' },
      { name: 'Azithromycin 500mg', batch: 'AZ09', expiry: '2025-10-20', hsn: '3004', gstRate: 12, mrp: 120, purchaseRate: 80, saleRate: 100, stock: 500, manufacturer: 'Sun Pharma' },
      { name: 'Vitamin C Chewable', batch: 'VC99', expiry: '2026-05-15', hsn: '3004', gstRate: 5, mrp: 50, purchaseRate: 25, saleRate: 35, stock: 200, manufacturer: 'Abbott' },
    ]);
  }
  
  const partyCount = await db.parties.count();
  if (partyCount === 0) {
    await db.parties.bulkAdd([
      { name: 'City Medical Store', gstin: '27ABCDE1234F1Z5', address: '123 Main St, Mumbai', phone: '9876543210', dlNo: 'MH-MZ1-123456' },
      { name: 'Wellness Pharmacy', gstin: '27FGHIJ5678K1Z9', address: '456 High St, Pune', phone: '9123456789', dlNo: 'MH-PZ1-654321' },
    ]);
  }

  const settingsCount = await db.settings.count();
  if (settingsCount === 0) {
    await db.settings.add({
      companyName: 'Gopi Distributors',
      addressLine1: '123, Pharma Market, Sector 5',
      addressLine2: 'Mumbai, Maharashtra - 400001',
      gstin: '27AAAAA0000A1Z5',
      dlNo1: 'MH-MZ1-000001',
      dlNo2: 'MH-MZ1-000002',
      phone: '+91 98765 43210',
      email: 'info@gopidistributors.com',
      terms: '1. Goods once sold will not be taken back.\n2. Interest @18% p.a. will be charged if payment is not made within due date.\n3. All disputes subject to Mumbai Jurisdiction.'
    });
  }
};