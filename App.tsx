import React, { useEffect } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { Inventory } from './components/Inventory';
import { Parties } from './components/Parties';
import { InvoiceForm } from './components/InvoiceForm';
import { InvoiceList } from './components/InvoiceList';
import { seedDatabase } from './db';
import { Toaster } from 'sonner';

const App: React.FC = () => {
  useEffect(() => {
    // Seed data for demo purposes
    seedDatabase();
  }, []);

  return (
    <HashRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/parties" element={<Parties />} />
          <Route path="/billing" element={<InvoiceForm />} />
          <Route path="/invoices" element={<InvoiceList />} />
        </Routes>
      </Layout>
      <Toaster position="top-right" />
    </HashRouter>
  );
};

export default App;