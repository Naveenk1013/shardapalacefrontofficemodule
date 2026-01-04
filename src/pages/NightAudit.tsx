import { useState, useEffect, useCallback } from 'react';
import { Moon, Check, AlertCircle, Clock, FileText, X } from 'lucide-react';
import Layout from '../components/Layout';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface NightAuditStats {
  totalRooms: number;
  occupiedRooms: number;
  vacantClean: number;
  vacantDirty: number;
  checkInsToday: number;
  checkOutsToday: number;
  stayovers: number;
  todayRevenue: number;
  pendingCharges: number;
}

interface InHouseBooking {
  id: string;
  check_in_date: string;
  expected_check_out_date: string;
  room_id: string;
  guests: {
    full_name: string;
  };
  rooms: {
    room_number: string;
    room_types: {
      name: string;
      base_rate: number;
    };
  };
}

export default function NightAudit() {
  const { user } = useAuth();
  const [stats, setStats] = useState<NightAuditStats>({
    totalRooms: 0,
    occupiedRooms: 0,
    vacantClean: 0,
    vacantDirty: 0,
    checkInsToday: 0,
    checkOutsToday: 0,
    stayovers: 0,
    todayRevenue: 0,
    pendingCharges: 0,
  });
  const [inHouseBookings, setInHouseBookings] = useState<InHouseBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [auditComplete, setAuditComplete] = useState(false);
  const [auditResults, setAuditResults] = useState<{
    chargesPosted: number;
    totalAmount: number;
  } | null>(null);

  const today = new Date().toISOString().split('T')[0];
  const auditDate = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  const loadAuditData = useCallback(async () => {
    setLoading(true);
    try {
      // Load rooms
      const { data: rooms } = await supabase
        .from('rooms')
        .select('*');

      // Load in-house bookings
      const { data: bookings } = await supabase
        .from('bookings')
        .select('*, guests(*), rooms(*, room_types(*))')
        .eq('status', 'checked_in');

      // Load today's check-ins
      const { data: checkIns } = await supabase
        .from('bookings')
        .select('*')
        .gte('check_in_date', `${today}T00:00:00`)
        .lte('check_in_date', `${today}T23:59:59`);

      // Load today's check-outs
      const { data: checkOuts } = await supabase
        .from('bookings')
        .select('*')
        .eq('status', 'checked_out')
        .gte('actual_check_out_date', `${today}T00:00:00`)
        .lte('actual_check_out_date', `${today}T23:59:59`);

      // Load today's revenue
      const { data: payments } = await supabase
        .from('payments')
        .select('amount')
        .gte('payment_date', `${today}T00:00:00`)
        .lte('payment_date', `${today}T23:59:59`);

      const todayRevenue = payments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;

      // Calculate stayovers (bookings that span multiple days)
      const stayovers = bookings?.filter(b => {
        const checkIn = new Date(b.check_in_date).toISOString().split('T')[0];
        return checkIn < today;
      }).length || 0;

      setStats({
        totalRooms: rooms?.length || 0,
        occupiedRooms: rooms?.filter(r => r.status === 'occupied').length || 0,
        vacantClean: rooms?.filter(r => r.status === 'vacant_clean').length || 0,
        vacantDirty: rooms?.filter(r => r.status === 'vacant_dirty').length || 0,
        checkInsToday: checkIns?.length || 0,
        checkOutsToday: checkOuts?.length || 0,
        stayovers,
        todayRevenue,
        pendingCharges: stayovers,
      });

      setInHouseBookings(bookings || []);
    } catch (error) {
      console.error('Error loading audit data:', error);
    } finally {
      setLoading(false);
    }
  }, [today]);

  useEffect(() => {
    loadAuditData();
  }, [loadAuditData]);

  const runNightAudit = async () => {
    setProcessing(true);
    try {
      let chargesPosted = 0;
      let totalAmount = 0;

      // Post room charges for all stayover guests
      for (const booking of inHouseBookings) {
        const checkInDate = new Date(booking.check_in_date).toISOString().split('T')[0];
        
        // Only post charges for stayovers (not same-day check-ins)
        if (checkInDate < today) {
          const roomRate = booking.rooms.room_types.base_rate;
          
          // Check if charge already posted for today
          const { data: existingCharge } = await supabase
            .from('folio_charges')
            .select('*')
            .eq('booking_id', booking.id)
            .eq('charge_date', today)
            .eq('charge_type', 'room_rent');

          if (!existingCharge || existingCharge.length === 0) {
            // Post room charge
            await supabase.from('folio_charges').insert([{
              booking_id: booking.id,
              charge_date: today,
              description: `Room Rent - ${booking.rooms.room_number} (${booking.rooms.room_types.name})`,
              amount: roomRate,
              charge_type: 'room_rent',
              posted_by: user?.id,
            }]);

            chargesPosted++;
            totalAmount += roomRate;
          }
        }
      }

      setAuditResults({ chargesPosted, totalAmount });
      setAuditComplete(true);
      setShowConfirmModal(false);
    } catch (error) {
      console.error('Error running night audit:', error);
      alert('Error running night audit. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const occupancyRate = stats.totalRooms > 0 
    ? Math.round((stats.occupiedRooms / stats.totalRooms) * 100) 
    : 0;

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Loading audit data...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <Moon className="w-8 h-8 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-800">Night Audit</h1>
              <p className="text-gray-600">{auditDate}</p>
            </div>
          </div>
        </div>

        {/* Audit Complete Message */}
        {auditComplete && auditResults && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-8">
            <div className="flex items-center gap-3">
              <Check className="w-8 h-8 text-green-600" />
              <div>
                <h3 className="text-lg font-semibold text-green-800">Night Audit Complete!</h3>
                <p className="text-green-700">
                  Posted {auditResults.chargesPosted} room charges totaling ₹{auditResults.totalAmount.toFixed(2)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600">Occupancy Rate</div>
            <div className="text-2xl font-bold text-indigo-600">{occupancyRate}%</div>
            <div className="text-xs text-gray-500">{stats.occupiedRooms} of {stats.totalRooms} rooms</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600">Today's Revenue</div>
            <div className="text-2xl font-bold text-green-600">₹{stats.todayRevenue.toFixed(0)}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600">Check-Ins Today</div>
            <div className="text-2xl font-bold text-blue-600">{stats.checkInsToday}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600">Check-Outs Today</div>
            <div className="text-2xl font-bold text-orange-600">{stats.checkOutsToday}</div>
          </div>
        </div>

        {/* Room Status Summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-gray-600" />
              Room Status Summary
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-gray-600">Occupied</span>
                <span className="font-semibold text-red-600">{stats.occupiedRooms}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-gray-600">Vacant Clean</span>
                <span className="font-semibold text-green-600">{stats.vacantClean}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-gray-600">Vacant Dirty</span>
                <span className="font-semibold text-yellow-600">{stats.vacantDirty}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-gray-600">Total Rooms</span>
                <span className="font-semibold text-gray-800">{stats.totalRooms}</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-gray-600" />
              Pending Actions
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-gray-600">Stayover Guests</span>
                <span className="font-semibold text-gray-800">{stats.stayovers}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-gray-600">Room Charges to Post</span>
                <span className="font-semibold text-indigo-600">{stats.pendingCharges}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-gray-600">Rooms Needing Cleaning</span>
                <span className="font-semibold text-yellow-600">{stats.vacantDirty}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Stayover Guests List */}
        <div className="bg-white rounded-lg shadow mb-8">
          <div className="p-6 border-b">
            <h3 className="text-lg font-semibold text-gray-800">Stayover Guests ({stats.stayovers})</h3>
            <p className="text-sm text-gray-600">Room charges will be posted for these guests</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Room</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Guest</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Room Type</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {inHouseBookings
                  .filter(b => new Date(b.check_in_date).toISOString().split('T')[0] < today)
                  .map((booking) => (
                    <tr key={booking.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-800">{booking.rooms.room_number}</td>
                      <td className="px-4 py-3 text-gray-700">{booking.guests.full_name}</td>
                      <td className="px-4 py-3 text-gray-600">{booking.rooms.room_types.name}</td>
                      <td className="px-4 py-3 text-right font-medium text-gray-800">
                        ₹{booking.rooms.room_types.base_rate.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                {stats.stayovers === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                      No stayover guests for tonight
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Run Audit Button */}
        {!auditComplete && (
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold mb-1">Ready to Run Night Audit?</h3>
                <p className="opacity-90">
                  This will post room charges for all {stats.stayovers} stayover guests
                </p>
              </div>
              <button
                onClick={() => setShowConfirmModal(true)}
                disabled={stats.stayovers === 0}
                className="px-6 py-3 bg-white text-indigo-600 font-semibold rounded-lg hover:bg-gray-100 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Run Night Audit
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <AlertCircle className="w-6 h-6 text-indigo-600" />
                Confirm Night Audit
              </h3>
              <button
                onClick={() => setShowConfirmModal(false)}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="bg-indigo-50 p-4 rounded-lg mb-4">
              <p className="text-indigo-800">
                This action will:
              </p>
              <ul className="mt-2 space-y-1 text-indigo-700">
                <li>• Post room charges for {stats.stayovers} stayover guests</li>
                <li>• Add daily room rent to each guest's folio</li>
              </ul>
            </div>

            <p className="text-gray-600 mb-6">
              Are you sure you want to proceed?
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={runNightAudit}
                disabled={processing}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {processing ? 'Processing...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
