import { useState, useEffect } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Dashboard from './pages/Dashboard';
import Reservations from './pages/Reservations';
import Guests from './pages/Guests';
import InHouse from './pages/InHouse';
import CheckIn from './pages/CheckIn';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import TapeChart from './pages/TapeChart';
import NightAudit from './pages/NightAudit';
import RateCalendar from './pages/RateCalendar';

function App() {
  const [currentPage, setCurrentPage] = useState('dashboard');

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1);
      setCurrentPage(hash || 'dashboard');
    };

    window.addEventListener('hashchange', handleHashChange);
    handleHashChange();

    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const renderPage = () => {
    switch (currentPage) {
      case 'tapechart':
        return <TapeChart />;
      case 'reservations':
        return <Reservations />;
      case 'checkin':
        return <CheckIn />;
      case 'guests':
        return <Guests />;
      case 'inhouse':
        return <InHouse />;
      case 'reports':
        return <Reports />;
      case 'settings':
        return <Settings />;
      case 'nightaudit':
        return <NightAudit />;
      case 'ratecalendar':
        return <RateCalendar />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <AuthProvider>
      <ProtectedRoute>
        {renderPage()}
      </ProtectedRoute>
    </AuthProvider>
  );
}

export default App;
