import { ReactNode, useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Users,
  DoorOpen,
  LogOut,
  Menu,
  X,
  Settings,
  FileText,
  BedDouble,
  CalendarDays,
  Moon,
  DollarSign,
  UserCheck
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { profile, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentHash, setCurrentHash] = useState(window.location.hash);

  useEffect(() => {
    const handleHashChange = () => {
      setCurrentHash(window.location.hash);
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigation = [
    { name: 'Dashboard', icon: LayoutDashboard, href: '#dashboard' },
    { name: 'Tape Chart', icon: CalendarDays, href: '#tapechart' },
    { name: 'Reservations', icon: DoorOpen, href: '#reservations' },
    { name: 'Check-In', icon: UserCheck, href: '#checkin' },
    { name: 'Guests', icon: Users, href: '#guests' },
    { name: 'In-House', icon: BedDouble, href: '#inhouse' },
    ...(profile?.role === 'manager' ? [
      { name: 'Night Audit', icon: Moon, href: '#nightaudit' },
      { name: 'Rate Calendar', icon: DollarSign, href: '#ratecalendar' },
      { name: 'Reports', icon: FileText, href: '#reports' },
      { name: 'Settings', icon: Settings, href: '#settings' }
    ] : []),
  ];

  const isActive = (href: string) => {
    const hash = href.slice(1);
    return currentHash === href || (currentHash === '' && hash === 'dashboard');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex h-screen overflow-hidden">
        <aside className={`
          fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out
          lg:relative lg:translate-x-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}>
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between p-6 border-b">
              <h1 className="text-xl font-bold text-gray-800">Hotel PMS</h1>
              <button
                onClick={() => setSidebarOpen(false)}
                className="lg:hidden text-gray-600 hover:text-gray-800"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4">
              <nav className="space-y-1 px-3">
                {navigation.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.href);
                  return (
                    <a
                      key={item.name}
                      href={item.href}
                      className={`flex items-center px-4 py-3 rounded-lg transition ${
                        active
                          ? 'bg-blue-50 text-blue-600 font-medium'
                          : 'text-gray-700 hover:bg-blue-50 hover:text-blue-600'
                      }`}
                    >
                      <Icon className="w-5 h-5 mr-3" />
                      {item.name}
                    </a>
                  );
                })}
              </nav>
            </div>

            <div className="border-t p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm font-medium text-gray-800">{profile?.full_name}</p>
                  <p className="text-xs text-gray-500 capitalize">{profile?.role}</p>
                </div>
              </div>
              <button
                onClick={signOut}
                className="w-full flex items-center justify-center px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </button>
            </div>
          </div>
        </aside>

        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <main className="flex-1 overflow-y-auto">
          <div className="lg:hidden bg-white shadow-sm border-b">
            <div className="flex items-center justify-between p-4">
              <button
                onClick={() => setSidebarOpen(true)}
                className="text-gray-600 hover:text-gray-800"
              >
                <Menu className="w-6 h-6" />
              </button>
              <h1 className="text-lg font-semibold text-gray-800">Hotel PMS</h1>
              <div className="w-6"></div>
            </div>
          </div>

          <div className="p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
