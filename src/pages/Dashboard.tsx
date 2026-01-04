import { useEffect, useState } from 'react';
import { Home, DoorOpen, DoorClosed, AlertCircle, IndianRupee, X, Check, LogIn, LogOut, Sparkles } from 'lucide-react';
import { supabase } from '../lib/supabase';
import Layout from '../components/Layout';
import { useFrontDeskSync } from '../hooks/useRealtimeSync';

interface RoomWithType {
  id: string;
  room_number: string;
  floor: number;
  status: string;
  room_types: {
    name: string;
    base_rate: number;
  };
}

interface DashboardStats {
  totalRooms: number;
  occupied: number;
  available: number;
  dirty: number;
  outOfOrder: number;
  checkoutsToday: number;
  checkinsToday: number;
  todayRevenue: number;
}

const ROOM_STATUSES = [
  { value: 'vacant_clean', label: 'Vacant Clean', color: 'bg-green-500', description: 'Ready for check-in' },
  { value: 'vacant_dirty', label: 'Vacant Dirty', color: 'bg-yellow-500', description: 'Needs housekeeping' },
  { value: 'occupied', label: 'Occupied', color: 'bg-red-500', description: 'Guest in room' },
  { value: 'out_of_order', label: 'Out of Order', color: 'bg-gray-500', description: 'Under maintenance' },
];

interface ArrivalGuest {
  id: string;
  check_in_date: string;
  check_out_date: string;
  number_of_guests: number;
  guests: {
    full_name: string;
    mobile: string;
  };
  room_types: {
    name: string;
  };
}

interface DepartureGuest {
  id: string;
  check_in_date: string;
  expected_check_out_date: string;
  guests: {
    full_name: string;
    mobile: string;
  };
  rooms: {
    room_number: string;
    room_types: {
      name: string;
    };
  };
}

interface PaymentDetail {
  id: string;
  payment_date: string;
  amount: number;
  payment_mode: string;
  bookings: {
    guests: {
      full_name: string;
    };
    rooms: {
      room_number: string;
    };
  } | null;
}

export default function Dashboard() {
  const [rooms, setRooms] = useState<RoomWithType[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    totalRooms: 0,
    occupied: 0,
    available: 0,
    dirty: 0,
    outOfOrder: 0,
    checkoutsToday: 0,
    checkinsToday: 0,
    todayRevenue: 0,
  });
  const [loading, setLoading] = useState(true);
  const [selectedRoom, setSelectedRoom] = useState<RoomWithType | null>(null);
  const [updating, setUpdating] = useState(false);
  
  // Detail modal states
  const [showArrivalsModal, setShowArrivalsModal] = useState(false);
  const [showDeparturesModal, setShowDeparturesModal] = useState(false);
  const [showRevenueModal, setShowRevenueModal] = useState(false);
  const [showDirtyRoomsModal, setShowDirtyRoomsModal] = useState(false);
  const [arrivals, setArrivals] = useState<ArrivalGuest[]>([]);
  const [departures, setDepartures] = useState<DepartureGuest[]>([]);
  const [payments, setPayments] = useState<PaymentDetail[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const { data: roomsData, error: roomsError } = await supabase
        .from('rooms')
        .select('*, room_types(*)')
        .order('room_number');

      if (roomsError) throw roomsError;

      const typedRooms = roomsData as RoomWithType[];
      setRooms(typedRooms || []);

      const today = new Date().toISOString().split('T')[0];

      const { data: checkoutsData } = await supabase
        .from('bookings')
        .select('*')
        .eq('status', 'checked_in')
        .eq('expected_check_out_date', today);

      const { data: checkinsData } = await supabase
        .from('reservations')
        .select('*')
        .eq('status', 'confirmed')
        .eq('check_in_date', today);

      const { data: paymentsData } = await supabase
        .from('payments')
        .select('amount')
        .gte('payment_date', `${today}T00:00:00`)
        .lte('payment_date', `${today}T23:59:59`);

      const todayRevenue = paymentsData?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;

      setStats({
        totalRooms: typedRooms?.length || 0,
        occupied: typedRooms?.filter(r => r.status === 'occupied').length || 0,
        available: typedRooms?.filter(r => r.status === 'vacant_clean').length || 0,
        dirty: typedRooms?.filter(r => r.status === 'vacant_dirty').length || 0,
        outOfOrder: typedRooms?.filter(r => r.status === 'out_of_order').length || 0,
        checkoutsToday: checkoutsData?.length || 0,
        checkinsToday: checkinsData?.length || 0,
        todayRevenue,
      });
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Real-time sync - dashboard updates when any device makes changes
  useFrontDeskSync(loadDashboardData);

  const loadArrivals = async () => {
    setLoadingDetails(true);
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase
      .from('reservations')
      .select('*, guests(full_name, mobile), room_types(name)')
      .eq('status', 'confirmed')
      .eq('check_in_date', today)
      .order('check_in_date');
    
    setArrivals((data || []) as ArrivalGuest[]);
    setShowArrivalsModal(true);
    setLoadingDetails(false);
  };

  const loadDepartures = async () => {
    setLoadingDetails(true);
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase
      .from('bookings')
      .select('*, guests(full_name, mobile), rooms(room_number, room_types(name))')
      .eq('status', 'checked_in')
      .eq('expected_check_out_date', today)
      .order('expected_check_out_date');
    
    setDepartures((data || []) as DepartureGuest[]);
    setShowDeparturesModal(true);
    setLoadingDetails(false);
  };

  const loadRevenueDetails = async () => {
    setLoadingDetails(true);
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase
      .from('payments')
      .select('*, bookings(guests(full_name), rooms(room_number))')
      .gte('payment_date', `${today}T00:00:00`)
      .lte('payment_date', `${today}T23:59:59`)
      .order('payment_date', { ascending: false });
    
    setPayments((data || []) as PaymentDetail[]);
    setShowRevenueModal(true);
    setLoadingDetails(false);
  };

  const markRoomClean = async (roomId: string) => {
    await updateRoomStatus(roomId, 'vacant_clean');
    setShowDirtyRoomsModal(false);
    loadDashboardData();
  };

  const updateRoomStatus = async (roomId: string, newStatus: string) => {
    setUpdating(true);
    try {
      const { error } = await supabase
        .from('rooms')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', roomId);

      if (error) throw error;

      // Update local state
      setRooms(rooms.map(room => 
        room.id === roomId ? { ...room, status: newStatus } : room
      ));

      // Recalculate stats
      const updatedRooms = rooms.map(room => 
        room.id === roomId ? { ...room, status: newStatus } : room
      );
      setStats(prev => ({
        ...prev,
        occupied: updatedRooms.filter(r => r.status === 'occupied').length,
        available: updatedRooms.filter(r => r.status === 'vacant_clean').length,
        dirty: updatedRooms.filter(r => r.status === 'vacant_dirty').length,
        outOfOrder: updatedRooms.filter(r => r.status === 'out_of_order').length,
      }));

      setSelectedRoom(null);
    } catch (error) {
      console.error('Error updating room status:', error);
      alert('Failed to update room status. Please try again.');
    } finally {
      setUpdating(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'vacant_clean':
        return 'bg-green-100 border-green-300 text-green-800';
      case 'vacant_dirty':
        return 'bg-yellow-100 border-yellow-300 text-yellow-800';
      case 'occupied':
        return 'bg-red-100 border-red-300 text-red-800';
      case 'out_of_order':
        return 'bg-gray-100 border-gray-300 text-gray-800';
      default:
        return 'bg-gray-100 border-gray-300 text-gray-800';
    }
  };

  const formatStatus = (status: string) => {
    return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Loading dashboard...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Front Desk Dashboard</h1>
          <p className="text-gray-600">Real-time room availability and operations</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-600">Total Rooms</h3>
              <Home className="w-5 h-5 text-blue-600" />
            </div>
            <p className="text-3xl font-bold text-gray-800">{stats.totalRooms}</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-600">Available</h3>
              <DoorOpen className="w-5 h-5 text-green-600" />
            </div>
            <p className="text-3xl font-bold text-green-600">{stats.available}</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-600">Occupied</h3>
              <DoorClosed className="w-5 h-5 text-red-600" />
            </div>
            <p className="text-3xl font-bold text-red-600">{stats.occupied}</p>
          </div>

          <button
            onClick={loadRevenueDetails}
            className="bg-white rounded-lg shadow p-6 text-left hover:shadow-lg hover:ring-2 hover:ring-blue-300 transition cursor-pointer"
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-600">Today's Revenue</h3>
              <IndianRupee className="w-5 h-5 text-blue-600" />
            </div>
            <p className="text-3xl font-bold text-gray-800">₹{stats.todayRevenue.toFixed(0)}</p>
            <p className="text-xs text-blue-600 mt-1">Click to view details →</p>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
          <button
            onClick={loadArrivals}
            className="bg-white rounded-lg shadow p-6 text-left hover:shadow-lg hover:ring-2 hover:ring-blue-300 transition cursor-pointer"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Arrivals Today</h3>
              <LogIn className="w-5 h-5 text-blue-600" />
            </div>
            <p className="text-4xl font-bold text-blue-600">{stats.checkinsToday}</p>
            <p className="text-xs text-blue-600 mt-2">Click to view guests →</p>
          </button>

          <button
            onClick={loadDepartures}
            className="bg-white rounded-lg shadow p-6 text-left hover:shadow-lg hover:ring-2 hover:ring-orange-300 transition cursor-pointer"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Departures Today</h3>
              <LogOut className="w-5 h-5 text-orange-600" />
            </div>
            <p className="text-4xl font-bold text-orange-600">{stats.checkoutsToday}</p>
            <p className="text-xs text-orange-600 mt-2">Click to view guests →</p>
          </button>

          <button
            onClick={() => setShowDirtyRoomsModal(true)}
            className="bg-white rounded-lg shadow p-6 text-left hover:shadow-lg hover:ring-2 hover:ring-yellow-300 transition cursor-pointer"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Needs Cleaning</h3>
              <Sparkles className="w-5 h-5 text-yellow-600" />
            </div>
            <p className="text-4xl font-bold text-yellow-600">{stats.dirty}</p>
            <p className="text-xs text-yellow-600 mt-2">Click to mark clean →</p>
          </button>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Out of Order</h3>
              <AlertCircle className="w-5 h-5 text-gray-600" />
            </div>
            <p className="text-4xl font-bold text-gray-600">{stats.outOfOrder}</p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b">
            <h2 className="text-xl font-bold text-gray-800">Room Status Overview</h2>
            <p className="text-sm text-gray-600 mt-1">Click on a room to change its status</p>
          </div>

          <div className="p-6">
            {/* Status Legend */}
            <div className="flex flex-wrap gap-4 mb-6">
              {ROOM_STATUSES.map((status) => (
                <div key={status.value} className="flex items-center gap-2">
                  <div className={`w-4 h-4 rounded ${status.color}`}></div>
                  <span className="text-sm text-gray-600">{status.label}</span>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
              {rooms.map((room) => (
                <button
                  key={room.id}
                  onClick={() => setSelectedRoom(room)}
                  className={`p-4 rounded-lg border-2 transition hover:shadow-lg hover:scale-105 ${getStatusColor(room.status)}`}
                >
                  <div className="text-center">
                    <p className="text-2xl font-bold mb-1">{room.room_number}</p>
                    <p className="text-xs font-medium">{room.room_types.name}</p>
                    <p className="text-xs mt-2">{formatStatus(room.status)}</p>
                  </div>
                </button>
              ))}
            </div>

            {rooms.length === 0 && (
              <div className="text-center py-12">
                <Home className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600">No rooms configured yet</p>
                <p className="text-sm text-gray-500 mt-2">
                  Contact your manager to set up room inventory
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Room Status Modal */}
      {selectedRoom && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-bold text-gray-800">
                  Room {selectedRoom.room_number}
                </h3>
                <p className="text-gray-600">{selectedRoom.room_types.name} • Floor {selectedRoom.floor}</p>
              </div>
              <button
                onClick={() => setSelectedRoom(null)}
                className="p-2 hover:bg-gray-100 rounded-full transition"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">Current Status</p>
              <div className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(selectedRoom.status)}`}>
                {formatStatus(selectedRoom.status)}
              </div>
            </div>

            <div className="border-t pt-4">
              <p className="text-sm font-medium text-gray-700 mb-3">Change Status To:</p>
              <div className="space-y-2">
                {ROOM_STATUSES.map((status) => (
                  <button
                    key={status.value}
                    onClick={() => updateRoomStatus(selectedRoom.id, status.value)}
                    disabled={updating || selectedRoom.status === status.value}
                    className={`w-full flex items-center justify-between p-3 rounded-lg border transition ${
                      selectedRoom.status === status.value
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    } ${updating ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-4 h-4 rounded ${status.color}`}></div>
                      <div className="text-left">
                        <p className="font-medium text-gray-800">{status.label}</p>
                        <p className="text-xs text-gray-500">{status.description}</p>
                      </div>
                    </div>
                    {selectedRoom.status === status.value && (
                      <Check className="w-5 h-5 text-blue-600" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {updating && (
              <div className="mt-4 text-center text-sm text-gray-600">
                Updating room status...
              </div>
            )}
          </div>
        </div>
      )}

      {/* Arrivals Modal */}
      {showArrivalsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-bold text-gray-800">Today's Arrivals</h3>
                <p className="text-sm text-gray-600">Expected check-ins for {new Date().toLocaleDateString('en-IN')}</p>
              </div>
              <button
                onClick={() => setShowArrivalsModal(false)}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            {loadingDetails ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : arrivals.length > 0 ? (
              <div className="space-y-3">
                {arrivals.map((arrival) => (
                  <div key={arrival.id} className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <div>
                      <p className="font-medium text-gray-800">{arrival.guests.full_name}</p>
                      <p className="text-sm text-gray-600">📱 {arrival.guests.mobile}</p>
                      <p className="text-sm text-gray-500">{arrival.room_types.name} • {arrival.number_of_guests} guest(s)</p>
                    </div>
                    <div className="text-right">
                      <span className="px-3 py-1 bg-blue-600 text-white rounded-full text-xs">Pending Check-In</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <LogIn className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>No arrivals expected today</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Departures Modal */}
      {showDeparturesModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-bold text-gray-800">Today's Departures</h3>
                <p className="text-sm text-gray-600">Expected check-outs for {new Date().toLocaleDateString('en-IN')}</p>
              </div>
              <button
                onClick={() => setShowDeparturesModal(false)}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            {loadingDetails ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-2 border-orange-600 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : departures.length > 0 ? (
              <div className="space-y-3">
                {departures.map((departure) => (
                  <div key={departure.id} className="flex items-center justify-between p-4 bg-orange-50 rounded-lg border border-orange-200">
                    <div>
                      <p className="font-medium text-gray-800">{departure.guests.full_name}</p>
                      <p className="text-sm text-gray-600">📱 {departure.guests.mobile}</p>
                      <p className="text-sm text-gray-500">Room {departure.rooms.room_number} • {departure.rooms.room_types.name}</p>
                    </div>
                    <div className="text-right">
                      <span className="px-3 py-1 bg-orange-600 text-white rounded-full text-xs">Pending Check-Out</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <LogOut className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>No departures expected today</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Revenue Modal */}
      {showRevenueModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-bold text-gray-800">Today's Revenue</h3>
                <p className="text-sm text-gray-600">Payments received on {new Date().toLocaleDateString('en-IN')}</p>
              </div>
              <button
                onClick={() => setShowRevenueModal(false)}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            {loadingDetails ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-2 border-green-600 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : payments.length > 0 ? (
              <>
                <div className="bg-green-50 p-4 rounded-lg mb-4">
                  <p className="text-sm text-green-700">Total Revenue</p>
                  <p className="text-3xl font-bold text-green-700">₹{stats.todayRevenue.toLocaleString('en-IN')}</p>
                </div>
                <div className="space-y-2">
                  {payments.map((payment) => (
                    <div key={payment.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-800">
                          {payment.bookings?.guests?.full_name || 'Guest'}
                        </p>
                        <p className="text-sm text-gray-500">
                          {payment.bookings?.rooms?.room_number ? `Room ${payment.bookings.rooms.room_number}` : ''} • 
                          {payment.payment_mode.toUpperCase()} • 
                          {new Date(payment.payment_date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <p className="font-bold text-green-600">₹{payment.amount.toLocaleString('en-IN')}</p>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <IndianRupee className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>No payments received today</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Dirty Rooms Modal */}
      {showDirtyRoomsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-bold text-gray-800">Rooms Needing Cleaning</h3>
                <p className="text-sm text-gray-600">Click to mark as clean</p>
              </div>
              <button
                onClick={() => setShowDirtyRoomsModal(false)}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            {rooms.filter(r => r.status === 'vacant_dirty').length > 0 ? (
              <div className="space-y-2">
                {rooms.filter(r => r.status === 'vacant_dirty').map((room) => (
                  <button
                    key={room.id}
                    onClick={() => markRoomClean(room.id)}
                    className="w-full flex items-center justify-between p-4 bg-yellow-50 rounded-lg border border-yellow-200 hover:bg-yellow-100 transition"
                  >
                    <div className="text-left">
                      <p className="font-bold text-lg text-gray-800">{room.room_number}</p>
                      <p className="text-sm text-gray-600">{room.room_types.name} • Floor {room.floor}</p>
                    </div>
                    <div className="flex items-center gap-2 text-green-600">
                      <Sparkles className="w-5 h-5" />
                      <span className="text-sm font-medium">Mark Clean</span>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Check className="w-12 h-12 mx-auto mb-3 text-green-500" />
                <p className="font-medium text-green-600">All rooms are clean!</p>
              </div>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
}

