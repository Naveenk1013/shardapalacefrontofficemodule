import { useState, useEffect } from 'react';
import { UserCheck, Search, Clock, Phone, User, CreditCard, Calendar, ChevronRight, Plus, Users, BedDouble, X, Check } from 'lucide-react';
import Layout from '../components/Layout';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useFrontDeskSync } from '../hooks/useRealtimeSync';

interface Reservation {
  id: string;
  check_in_date: string;
  check_out_date: string;
  number_of_guests: number;
  status: string;
  guests: {
    id: string;
    full_name: string;
    mobile: string;
    email?: string;
    address?: string;
    id_proof_type?: string;
    id_proof_number?: string;
  };
  room_types: {
    id: string;
    name: string;
    base_rate: number;
  };
  assigned_room_id?: string;
}

interface Room {
  id: string;
  room_number: string;
  floor: number;
  status: string;
  room_types: {
    id: string;
    name: string;
    base_rate: number;
  };
}

interface Guest {
  id: string;
  full_name: string;
  mobile: string;
  email?: string;
  address?: string;
  id_proof_type?: string;
  id_proof_number?: string;
}

export default function CheckIn() {
  const { user } = useAuth();
  const [todayArrivals, setTodayArrivals] = useState<Reservation[]>([]);
  const [pendingArrivals, setPendingArrivals] = useState<Reservation[]>([]);
  const [availableRooms, setAvailableRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Guest[]>([]);
  const [showWalkInModal, setShowWalkInModal] = useState(false);
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<string>('');
  const [processing, setProcessing] = useState(false);
  const [walkInData, setWalkInData] = useState({
    guestName: '',
    mobile: '',
    email: '',
    idType: 'Aadhaar',
    idNumber: '',
    address: '',
    roomTypeId: '',
    roomId: '',
    numberOfGuests: 1,
    nights: 1,
    advancePayment: 0,
    paymentMode: 'cash'
  });
  const [roomTypes, setRoomTypes] = useState<{ id: string; name: string; base_rate: number }[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Load today's arrivals
      const { data: todayData } = await supabase
        .from('reservations')
        .select('*, guests(*), room_types(*)')
        .eq('status', 'confirmed')
        .eq('check_in_date', today)
        .order('guests(full_name)');

      // Load pending arrivals (overdue check-ins)
      const { data: pendingData } = await supabase
        .from('reservations')
        .select('*, guests(*), room_types(*)')
        .eq('status', 'confirmed')
        .lt('check_in_date', today)
        .order('check_in_date');

      // Load available rooms
      const { data: roomsData } = await supabase
        .from('rooms')
        .select('*, room_types(*)')
        .eq('status', 'vacant_clean')
        .order('room_number');

      // Load room types
      const { data: typesData } = await supabase
        .from('room_types')
        .select('id, name, base_rate')
        .eq('is_active', true)
        .order('name');

      setTodayArrivals(todayData || []);
      setPendingArrivals(pendingData || []);
      setAvailableRooms(roomsData || []);
      setRoomTypes(typesData || []);
    } catch (error) {
      console.error('Error loading check-in data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Real-time sync - check-in desk updates when any device makes changes
  useFrontDeskSync(loadData);

  const handleSearch = async (term: string) => {
    setSearchTerm(term);
    if (term.length < 2) {
      setSearchResults([]);
      return;
    }

    const { data } = await supabase
      .from('guests')
      .select('*')
      .or(`full_name.ilike.%${term}%,mobile.ilike.%${term}%`)
      .limit(5);

    setSearchResults(data || []);
  };

  const initiateCheckIn = (reservation: Reservation) => {
    setSelectedReservation(reservation);
    setSelectedRoom(reservation.assigned_room_id || '');
    setShowCheckInModal(true);
  };

  const processCheckIn = async () => {
    if (!selectedReservation || !selectedRoom) return;

    setProcessing(true);
    try {
      const room = availableRooms.find(r => r.id === selectedRoom);
      if (!room) throw new Error('Room not found');

      // Calculate nights
      const checkIn = new Date();
      const checkOut = new Date(selectedReservation.check_out_date);
      const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));

      // Create booking
      const { data: bookingData, error: bookingError } = await supabase
        .from('bookings')
        .insert([{
          guest_id: selectedReservation.guests.id,
          room_id: selectedRoom,
          check_in_date: new Date().toISOString(),
          expected_check_out_date: selectedReservation.check_out_date,
          number_of_guests: selectedReservation.number_of_guests,
          status: 'checked_in',
          checked_in_by: user?.id
        }])
        .select()
        .single();

      if (bookingError) throw bookingError;

      // Add room charge
      const roomRate = room.room_types.base_rate * nights;
      await supabase.from('folio_charges').insert([{
        booking_id: bookingData.id,
        charge_date: new Date().toISOString(),
        description: `Room Charge - ${room.room_types.name} (${nights} nights)`,
        amount: roomRate,
        charge_type: 'room'
      }]);

      // Update room status
      await supabase
        .from('rooms')
        .update({ status: 'occupied' })
        .eq('id', selectedRoom);

      // Update reservation status
      await supabase
        .from('reservations')
        .update({ status: 'checked_in' })
        .eq('id', selectedReservation.id);

      setShowCheckInModal(false);
      setSelectedReservation(null);
      setSelectedRoom('');
      loadData();
      alert(`Guest ${selectedReservation.guests.full_name} checked in successfully to Room ${room.room_number}!`);
    } catch (error) {
      console.error('Error processing check-in:', error);
      alert('Failed to process check-in. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const processWalkIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!walkInData.guestName || !walkInData.mobile || !walkInData.roomId) return;

    setProcessing(true);
    try {
      // Check if guest exists
      const { data: existingGuest } = await supabase
        .from('guests')
        .select('id')
        .eq('mobile', walkInData.mobile)
        .single();

      let guestId = existingGuest?.id;

      if (!guestId) {
        // Create new guest
        const { data: newGuest, error: guestError } = await supabase
          .from('guests')
          .insert([{
            full_name: walkInData.guestName,
            mobile: walkInData.mobile,
            email: walkInData.email || null,
            id_proof_type: walkInData.idType,
            id_proof_number: walkInData.idNumber,
            address: walkInData.address || null
          }])
          .select()
          .single();

        if (guestError) throw guestError;
        guestId = newGuest?.id;
      }

      const room = availableRooms.find(r => r.id === walkInData.roomId);
      if (!room || !guestId) throw new Error('Room or guest not found');

      // Calculate checkout date
      const checkOut = new Date();
      checkOut.setDate(checkOut.getDate() + walkInData.nights);

      // Create booking
      const { data: bookingData, error: bookingError } = await supabase
        .from('bookings')
        .insert([{
          guest_id: guestId,
          room_id: walkInData.roomId,
          check_in_date: new Date().toISOString(),
          expected_check_out_date: checkOut.toISOString(),
          number_of_guests: walkInData.numberOfGuests,
          advance_payment: walkInData.advancePayment,
          status: 'checked_in',
          checked_in_by: user?.id
        }])
        .select()
        .single();

      if (bookingError) throw bookingError;

      // Add room charge
      const roomRate = room.room_types.base_rate * walkInData.nights;
      await supabase.from('folio_charges').insert([{
        booking_id: bookingData.id,
        charge_date: new Date().toISOString(),
        description: `Room Charge - ${room.room_types.name} (${walkInData.nights} nights)`,
        amount: roomRate,
        charge_type: 'room'
      }]);

      // Add advance payment if any
      if (walkInData.advancePayment > 0) {
        await supabase.from('payments').insert([{
          booking_id: bookingData.id,
          payment_date: new Date().toISOString(),
          amount: walkInData.advancePayment,
          payment_mode: walkInData.paymentMode,
          received_by: user?.id
        }]);
      }

      // Update room status
      await supabase
        .from('rooms')
        .update({ status: 'occupied' })
        .eq('id', walkInData.roomId);

      setShowWalkInModal(false);
      setWalkInData({
        guestName: '',
        mobile: '',
        email: '',
        idType: 'Aadhaar',
        idNumber: '',
        address: '',
        roomTypeId: '',
        roomId: '',
        numberOfGuests: 1,
        nights: 1,
        advancePayment: 0,
        paymentMode: 'cash'
      });
      loadData();
      alert(`Walk-in guest ${walkInData.guestName} checked in successfully to Room ${room.room_number}!`);
    } catch (error) {
      console.error('Error processing walk-in:', error);
      alert('Failed to process walk-in. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const filteredRoomsByType = (typeId: string) => {
    return availableRooms.filter(r => r.room_types.id === typeId);
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Loading arrivals...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2 flex items-center gap-3">
              <UserCheck className="w-8 h-8 text-green-600" />
              Check-In Desk
            </h1>
            <p className="text-gray-600">Quick check-in for arrivals and walk-in guests</p>
          </div>
          <button
            onClick={() => setShowWalkInModal(true)}
            className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium"
          >
            <Plus className="w-5 h-5" />
            Walk-In Check-In
          </button>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-600">{todayArrivals.length}</div>
                <div className="text-sm text-gray-600">Today's Arrivals</div>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                <Clock className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-orange-600">{pendingArrivals.length}</div>
                <div className="text-sm text-gray-600">Overdue</div>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                <BedDouble className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">{availableRooms.length}</div>
                <div className="text-sm text-gray-600">Rooms Ready</div>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                <Users className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-purple-600">
                  {todayArrivals.reduce((sum, r) => sum + r.number_of_guests, 0)}
                </div>
                <div className="text-sm text-gray-600">Expected Guests</div>
              </div>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search guest by name or mobile..."
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          {searchResults.length > 0 && (
            <div className="mt-2 border rounded-lg overflow-hidden">
              {searchResults.map(guest => (
                <div key={guest.id} className="flex items-center justify-between p-3 hover:bg-gray-50 border-b last:border-b-0">
                  <div>
                    <div className="font-medium text-gray-800">{guest.full_name}</div>
                    <div className="text-sm text-gray-500">📱 {guest.mobile}</div>
                  </div>
                  <button
                    onClick={() => {
                      setWalkInData(prev => ({
                        ...prev,
                        guestName: guest.full_name,
                        mobile: guest.mobile,
                        email: guest.email || '',
                        idType: guest.id_proof_type || 'Aadhaar',
                        idNumber: guest.id_proof_number || '',
                        address: guest.address || ''
                      }));
                      setShowWalkInModal(true);
                      setSearchTerm('');
                      setSearchResults([]);
                    }}
                    className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                  >
                    Check-In
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Overdue Arrivals */}
        {pendingArrivals.length > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
            <h2 className="text-lg font-bold text-orange-800 mb-3 flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Overdue Check-Ins ({pendingArrivals.length})
            </h2>
            <div className="space-y-2">
              {pendingArrivals.map(reservation => (
                <div key={reservation.id} className="flex items-center justify-between bg-white rounded-lg p-3 border border-orange-200">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                      <User className="w-5 h-5 text-orange-600" />
                    </div>
                    <div>
                      <div className="font-medium text-gray-800">{reservation.guests.full_name}</div>
                      <div className="text-sm text-gray-500">
                        {reservation.room_types.name} • Due: {new Date(reservation.check_in_date).toLocaleDateString('en-IN')}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => initiateCheckIn(reservation)}
                    className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition"
                  >
                    Check-In <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Today's Arrivals */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b">
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-600" />
              Today's Arrivals - {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
            </h2>
          </div>
          
          {todayArrivals.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <UserCheck className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium">No arrivals scheduled for today</p>
              <p className="text-sm mt-2">Use "Walk-In Check-In" for unscheduled guests</p>
            </div>
          ) : (
            <div className="divide-y">
              {todayArrivals.map(reservation => (
                <div key={reservation.id} className="p-4 hover:bg-gray-50 transition">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                        <User className="w-6 h-6 text-blue-600" />
                      </div>
                      <div>
                        <div className="font-bold text-gray-800 text-lg">{reservation.guests.full_name}</div>
                        <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                          <span className="flex items-center gap-1">
                            <Phone className="w-4 h-4" />
                            {reservation.guests.mobile}
                          </span>
                          <span className="flex items-center gap-1">
                            <BedDouble className="w-4 h-4" />
                            {reservation.room_types.name}
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="w-4 h-4" />
                            {reservation.number_of_guests} guest(s)
                          </span>
                        </div>
                        <div className="text-sm text-gray-500 mt-1">
                          Stay: {new Date(reservation.check_in_date).toLocaleDateString('en-IN')} → {new Date(reservation.check_out_date).toLocaleDateString('en-IN')}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => initiateCheckIn(reservation)}
                      className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium"
                    >
                      <UserCheck className="w-5 h-5" />
                      Check-In
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Check-In Modal (for reservations) */}
      {showCheckInModal && selectedReservation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-lg w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xl font-bold text-gray-800">Complete Check-In</h3>
                <p className="text-sm text-gray-600">{selectedReservation.guests.full_name}</p>
              </div>
              <button
                onClick={() => {
                  setShowCheckInModal(false);
                  setSelectedReservation(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Guest Info Summary */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500">Mobile:</span>
                    <span className="ml-2 font-medium">{selectedReservation.guests.mobile}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Guests:</span>
                    <span className="ml-2 font-medium">{selectedReservation.number_of_guests}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Room Type:</span>
                    <span className="ml-2 font-medium">{selectedReservation.room_types.name}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Checkout:</span>
                    <span className="ml-2 font-medium">{new Date(selectedReservation.check_out_date).toLocaleDateString('en-IN')}</span>
                  </div>
                </div>
              </div>

              {/* Room Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Assign Room ({selectedReservation.room_types.name})
                </label>
                <select
                  value={selectedRoom}
                  onChange={(e) => setSelectedRoom(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  required
                >
                  <option value="">Select a room...</option>
                  {availableRooms
                    .filter(r => r.room_types.id === selectedReservation.room_types.id)
                    .map(room => (
                      <option key={room.id} value={room.id}>
                        Room {room.room_number} (Floor {room.floor})
                      </option>
                    ))}
                </select>
                {availableRooms.filter(r => r.room_types.id === selectedReservation.room_types.id).length === 0 && (
                  <p className="text-red-500 text-sm mt-1">No clean rooms available for this type</p>
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowCheckInModal(false);
                    setSelectedReservation(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={processCheckIn}
                  disabled={!selectedRoom || processing}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {processing ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <Check className="w-5 h-5" />
                      Confirm Check-In
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Walk-In Modal */}
      {showWalkInModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xl font-bold text-gray-800">Walk-In Check-In</h3>
                <p className="text-sm text-gray-600">Register a new guest without prior reservation</p>
              </div>
              <button
                onClick={() => setShowWalkInModal(false)}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <form onSubmit={processWalkIn} className="space-y-4">
              {/* Guest Details */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-800 mb-3 flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Guest Details
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                    <input
                      type="text"
                      value={walkInData.guestName}
                      onChange={(e) => setWalkInData(prev => ({ ...prev, guestName: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Mobile *</label>
                    <input
                      type="tel"
                      value={walkInData.mobile}
                      onChange={(e) => setWalkInData(prev => ({ ...prev, mobile: e.target.value }))}
                      pattern="[0-9]{10}"
                      placeholder="10-digit mobile"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                      type="email"
                      value={walkInData.email}
                      onChange={(e) => setWalkInData(prev => ({ ...prev, email: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">ID Proof Type</label>
                    <select
                      value={walkInData.idType}
                      onChange={(e) => setWalkInData(prev => ({ ...prev, idType: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    >
                      <option>Aadhaar</option>
                      <option>Passport</option>
                      <option>Driving License</option>
                      <option>Voter ID</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">ID Number</label>
                    <input
                      type="text"
                      value={walkInData.idNumber}
                      onChange={(e) => setWalkInData(prev => ({ ...prev, idNumber: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                    <input
                      type="text"
                      value={walkInData.address}
                      onChange={(e) => setWalkInData(prev => ({ ...prev, address: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                </div>
              </div>

              {/* Room Selection */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-800 mb-3 flex items-center gap-2">
                  <BedDouble className="w-4 h-4" />
                  Room Selection
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Room Type *</label>
                    <select
                      value={walkInData.roomTypeId}
                      onChange={(e) => setWalkInData(prev => ({ ...prev, roomTypeId: e.target.value, roomId: '' }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                      required
                    >
                      <option value="">Select type...</option>
                      {roomTypes.map(type => (
                        <option key={type.id} value={type.id}>
                          {type.name} (₹{type.base_rate}/night)
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Room *</label>
                    <select
                      value={walkInData.roomId}
                      onChange={(e) => setWalkInData(prev => ({ ...prev, roomId: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                      required
                      disabled={!walkInData.roomTypeId}
                    >
                      <option value="">Select room...</option>
                      {filteredRoomsByType(walkInData.roomTypeId).map(room => (
                        <option key={room.id} value={room.id}>
                          {room.room_number} (Floor {room.floor})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Number of Guests</label>
                    <input
                      type="number"
                      min={1}
                      max={4}
                      value={walkInData.numberOfGuests}
                      onChange={(e) => setWalkInData(prev => ({ ...prev, numberOfGuests: parseInt(e.target.value) }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                </div>
              </div>

              {/* Stay & Payment */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-800 mb-3 flex items-center gap-2">
                  <CreditCard className="w-4 h-4" />
                  Stay & Payment
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Number of Nights</label>
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={walkInData.nights}
                      onChange={(e) => setWalkInData(prev => ({ ...prev, nights: parseInt(e.target.value) }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Advance Payment (₹)</label>
                    <input
                      type="number"
                      min={0}
                      value={walkInData.advancePayment}
                      onChange={(e) => setWalkInData(prev => ({ ...prev, advancePayment: parseFloat(e.target.value) || 0 }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Payment Mode</label>
                    <select
                      value={walkInData.paymentMode}
                      onChange={(e) => setWalkInData(prev => ({ ...prev, paymentMode: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    >
                      <option value="cash">Cash</option>
                      <option value="card">Card</option>
                      <option value="upi">UPI</option>
                      <option value="bank_transfer">Bank Transfer</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowWalkInModal(false)}
                  className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!walkInData.guestName || !walkInData.mobile || !walkInData.roomId || processing}
                  className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium"
                >
                  {processing ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <UserCheck className="w-5 h-5" />
                      Complete Check-In
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
