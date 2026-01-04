import { useState, useEffect } from 'react';
import { Calendar, DollarSign, TrendingUp, Users, Download } from 'lucide-react';
import Layout from '../components/Layout';
import { supabase } from '../lib/supabase';

interface ReportStats {
  todayArrivals: number;
  todayDepartures: number;
  inHouseGuests: number;
  occupancyRate: number;
  todayRevenue: number;
  monthRevenue: number;
  totalRooms: number;
}

interface Arrival {
  guest_name: string;
  room_number: string;
  room_type: string;
  check_in_date: string;
}

interface Departure {
  guest_name: string;
  room_number: string;
  room_type: string;
  check_out_date: string;
}

export default function Reports() {
  const [reportType, setReportType] = useState<'summary' | 'arrivals' | 'departures' | 'occupancy' | 'revenue'>('summary');
  const [stats, setStats] = useState<ReportStats>({
    todayArrivals: 0,
    todayDepartures: 0,
    inHouseGuests: 0,
    occupancyRate: 0,
    todayRevenue: 0,
    monthRevenue: 0,
    totalRooms: 0,
  });
  const [arrivals, setArrivals] = useState<Arrival[]>([]);
  const [departures, setDepartures] = useState<Departure[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    loadReportData();
  }, [selectedDate]);

  const loadReportData = async () => {
    try {
      const today = selectedDate;
      const monthStart = `${today.substring(0, 7)}-01`;

      const { data: rooms } = await supabase
        .from('rooms')
        .select('*');

      const totalRooms = rooms?.length || 0;

      const { data: bookings } = await supabase
        .from('bookings')
        .select('*, guests(*), rooms(*, room_types(*))')
        .eq('status', 'checked_in');

      const inHouseGuests = bookings?.length || 0;
      const occupancyRate = totalRooms > 0 ? (inHouseGuests / totalRooms) * 100 : 0;

      const { data: reservationsToday } = await supabase
        .from('reservations')
        .select('*')
        .eq('check_in_date', today)
        .eq('status', 'confirmed');

      const { data: checkoutsToday } = await supabase
        .from('bookings')
        .select('*')
        .eq('expected_check_out_date', today)
        .eq('status', 'checked_in');

      const { data: paymentsToday } = await supabase
        .from('payments')
        .select('amount')
        .gte('payment_date', `${today}T00:00:00`)
        .lte('payment_date', `${today}T23:59:59`);

      const todayRevenue = paymentsToday?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;

      const { data: paymentsMonth } = await supabase
        .from('payments')
        .select('amount')
        .gte('payment_date', `${monthStart}T00:00:00`);

      const monthRevenue = paymentsMonth?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;

      const { data: arrivalsData } = await supabase
        .from('reservations')
        .select('*, guests(*), room_types(*)')
        .eq('check_in_date', today)
        .eq('status', 'confirmed');

      const formattedArrivals = arrivalsData?.map(a => ({
        guest_name: a.guests.full_name,
        room_number: 'TBA',
        room_type: a.room_types.name,
        check_in_date: a.check_in_date,
      })) || [];

      const { data: departuresData } = await supabase
        .from('bookings')
        .select('*, guests(*), rooms(*, room_types(*))')
        .eq('expected_check_out_date', today)
        .eq('status', 'checked_in');

      const formattedDepartures = departuresData?.map(d => ({
        guest_name: d.guests.full_name,
        room_number: d.rooms.room_number,
        room_type: d.rooms.room_types.name,
        check_out_date: d.expected_check_out_date,
      })) || [];

      setStats({
        todayArrivals: reservationsToday?.length || 0,
        todayDepartures: checkoutsToday?.length || 0,
        inHouseGuests,
        occupancyRate,
        todayRevenue,
        monthRevenue,
        totalRooms,
      });

      setArrivals(formattedArrivals);
      setDepartures(formattedDepartures);
    } catch (error) {
      console.error('Error loading report data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Loading reports...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Reports</h1>
            <p className="text-gray-600">Business insights and operational reports</p>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <button className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
              <Download className="w-4 h-4 mr-2" />
              Export
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-600">Today's Arrivals</h3>
              <Calendar className="w-5 h-5 text-green-600" />
            </div>
            <p className="text-3xl font-bold text-gray-800">{stats.todayArrivals}</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-600">Today's Departures</h3>
              <Calendar className="w-5 h-5 text-orange-600" />
            </div>
            <p className="text-3xl font-bold text-gray-800">{stats.todayDepartures}</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-600">In-House Guests</h3>
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <p className="text-3xl font-bold text-gray-800">{stats.inHouseGuests}</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-600">Occupancy Rate</h3>
              <TrendingUp className="w-5 h-5 text-blue-600" />
            </div>
            <p className="text-3xl font-bold text-gray-800">{stats.occupancyRate.toFixed(1)}%</p>
            <p className="text-xs text-gray-500 mt-1">{stats.inHouseGuests} of {stats.totalRooms} rooms</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Today's Revenue</h3>
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
            <p className="text-4xl font-bold text-green-600">₹{stats.todayRevenue.toFixed(0)}</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Month-to-Date Revenue</h3>
              <TrendingUp className="w-5 h-5 text-blue-600" />
            </div>
            <p className="text-4xl font-bold text-blue-600">₹{stats.monthRevenue.toFixed(0)}</p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow mb-6">
          <div className="border-b">
            <nav className="flex space-x-8 px-6">
              <button
                onClick={() => setReportType('arrivals')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  reportType === 'arrivals'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-800'
                }`}
              >
                Arrivals List
              </button>
              <button
                onClick={() => setReportType('departures')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  reportType === 'departures'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-800'
                }`}
              >
                Departures List
              </button>
            </nav>
          </div>

          <div className="p-6">
            {reportType === 'arrivals' && (
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Expected Arrivals</h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Guest Name</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Room Type</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Check-In Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {arrivals.map((arrival, idx) => (
                        <tr key={idx}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-800">{arrival.guest_name}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{arrival.room_type}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {new Date(arrival.check_in_date).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {arrivals.length === 0 && (
                    <div className="text-center py-8 text-gray-500">No arrivals scheduled for this date</div>
                  )}
                </div>
              </div>
            )}

            {reportType === 'departures' && (
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Expected Departures</h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Guest Name</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Room Number</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Room Type</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Check-Out Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {departures.map((departure, idx) => (
                        <tr key={idx}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-800">{departure.guest_name}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{departure.room_number}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{departure.room_type}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {new Date(departure.check_out_date).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {departures.length === 0 && (
                    <div className="text-center py-8 text-gray-500">No departures scheduled for this date</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
