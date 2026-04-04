import {
  LayoutDashboard,
  Wallet,
  ShoppingCart,
  TrendingUp,
  Gift,
  Settings,
} from 'lucide-react';

export type TabId = 'dashboard' | 'income' | 'expense' | 'investment' | 'furusato' | 'settings';

interface NavItem {
  id: TabId;
  label: string;
  icon: typeof LayoutDashboard;
}

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'ダッシュボード', icon: LayoutDashboard },
  { id: 'income', label: '収入管理', icon: Wallet },
  { id: 'expense', label: '支出管理', icon: ShoppingCart },
  { id: 'investment', label: '投資管理', icon: TrendingUp },
  { id: 'furusato', label: 'ふるさと納税', icon: Gift },
  { id: 'settings', label: '設定', icon: Settings },
];

const MOBILE_LABELS: Record<TabId, string> = {
  dashboard: 'ホーム',
  income: '収入',
  expense: '支出',
  investment: '投資',
  furusato: 'ふるさと',
  settings: '設定',
};

interface Props {
  active: TabId;
  onChange: (tab: TabId) => void;
}

export default function Navigation({ active, onChange }: Props) {
  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-56 bg-white border-r border-gray-100 min-h-screen fixed left-0 top-0 z-10">
        <div className="px-5 py-5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white text-sm font-bold">資</span>
            </div>
            <div>
              <p className="text-sm font-bold text-gray-800">資産管理</p>
              <p className="text-xs text-gray-400">Personal Finance</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = active === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onChange(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'
                }`}
              >
                <Icon size={18} className={isActive ? 'text-blue-600' : 'text-gray-400'} />
                {item.label}
              </button>
            );
          })}
        </nav>
        <div className="px-5 py-4 border-t border-gray-100">
          <p className="text-xs text-gray-400">日本の税制対応版</p>
        </div>
      </aside>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-10 safe-area-pb">
        <div className="flex justify-around px-1 py-1">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = active === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onChange(item.id)}
                className={`flex flex-col items-center gap-0.5 px-1 py-2 min-w-0 flex-1 rounded-lg transition-colors ${
                  isActive ? 'text-blue-600' : 'text-gray-400'
                }`}
              >
                <Icon size={22} />
                <span className="text-[10px] font-medium leading-tight text-center">
                  {MOBILE_LABELS[item.id]}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
