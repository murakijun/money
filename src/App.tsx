import { useState, useEffect, useCallback } from 'react';
import Navigation, { type TabId } from './components/Navigation';
import Dashboard from './components/Dashboard';
import IncomeManager from './components/IncomeManager';
import ExpenseManager from './components/ExpenseManager';
import InvestmentManager from './components/InvestmentManager';
import FurusatoManager from './components/FurusatoManager';
import Settings from './components/Settings';
import type { AppData } from './types';
import { loadData, saveData } from './utils/storage';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [data, setData] = useState<AppData>(() => loadData());

  const handleDataChange = useCallback((newData: AppData) => {
    setData(newData);
    saveData(newData);
  }, []);

  useEffect(() => {
    const handleUnload = () => saveData(data);
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [data]);

  const contentPadding = 'md:ml-56 min-h-screen pb-20 md:pb-6';

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation active={activeTab} onChange={setActiveTab} />
      <main className={`${contentPadding} px-4 md:px-8 py-6`}>
        <div className="max-w-5xl mx-auto">
          {activeTab === 'dashboard' && <Dashboard data={data} />}
          {activeTab === 'income' && <IncomeManager data={data} onChange={handleDataChange} />}
          {activeTab === 'expense' && <ExpenseManager data={data} onChange={handleDataChange} />}
          {activeTab === 'investment' && <InvestmentManager data={data} onChange={handleDataChange} />}
          {activeTab === 'furusato' && <FurusatoManager data={data} onChange={handleDataChange} />}
          {activeTab === 'settings' && <Settings data={data} onChange={handleDataChange} />}
        </div>
      </main>
    </div>
  );
}
