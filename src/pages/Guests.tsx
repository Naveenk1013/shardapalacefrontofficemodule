import { useState, useEffect } from 'react';
import { User, Search, LogIn, Calendar, Phone, History, IndianRupee, Star, Award, FileText, Download } from 'lucide-react';
import Layout from '../components/Layout';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import DocumentViewer from '../components/DocumentViewer';
import ExportDataModal from '../components/ExportDataModal';
import { getArchivedDocuments } from '../lib/documentArchiveService';

interface Guest {
  id: string;
  full_name: string;
  mobile: string;
  email: string;
  address: string;
  id_proof_type: string;
  id_proof_number: string;
}

interface Reservation {
  id: string;
  check_in_date: string;
  check_out_date: string;
  number_of_guests: number;
  room_types: {
    id: string;
    name: string;
    base_rate: number;
  };
}

interface Room {
  id: string;
  room_number: string;
  room_type_id: string;
  status: string;
  room_types: {
    name: string;
    base_rate: number;
  };
}

interface StayHistory {
  id: string;
  check_in_date: string;
  expected_check_out_date: string;
  actual_check_out_date: string | null;
  status: string;
  advance_payment: number;
  rooms: {
    room_number: string;
    room_types: {
      name: string;
    };
  };
  totalCharges: number;
  totalPayments: number;
  archivedDocs: ArchivedDocument[];
}

interface ArchivedDocument {
  id: string;
  document_type: 'invoice' | 'grc';
  document_number: string;
  document_html: string;
  created_at: string;
}

interface GuestStats {
  totalStays: number;
  totalSpend: number;
  isVIP: boolean;
}

export default function Guests() {
  const { user } = useAuth();
  const [guests, setGuests] = useState<Guest[]>([]);
  const [filteredGuests, setFilteredGuests] = useState<Guest[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [stayHistory, setStayHistory] = useState<StayHistory[]>([]);
  const [guestStats, setGuestStats] = useState<GuestStats>({ totalStays: 0, totalSpend: 0, isVIP: false });
  const [availableRooms, setAvailableRooms] = useState<Room[]>([]);
  const [showCheckinModal, setShowCheckinModal] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<ArchivedDocument | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);

  useEffect(() => {
    loadGuests();
  }, []);

  useEffect(() => {
    const filtered = guests.filter(guest =>
      guest.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      guest.mobile.includes(searchTerm)
    );
    setFilteredGuests(filtered);
  }, [searchTerm, guests]);

  const loadGuests = async () => {
    try {
      const { data, error } = await supabase
        .from('guests')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setGuests(data || []);
      setFilteredGuests(data || []);
    } catch (error) {
      console.error('Error loading guests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectGuest = async (guest: Guest) => {
    setSelectedGuest(guest);
    setLoadingHistory(true);

    const today = new Date().toISOString().split('T')[0];
    
    // Load active reservations
    const { data: reservationsData } = await supabase
      .from('reservations')
      .select('*, room_types(*)')
      .eq('guest_id', guest.id)
      .eq('status', 'confirmed')
      .lte('check_in_date', today)
      .order('check_in_date');

    setReservations(reservationsData as Reservation[] || []);

    // Load stay history (all bookings for this guest)
    const { data: bookingsData } = await supabase
      .from('bookings')
      .select('*, rooms(room_number, room_types(name))')
      .eq('guest_id', guest.id)
      .order('check_in_date', { ascending: false });

    // Calculate totals for each booking
    let totalSpend = 0;
    const historyWithTotals: StayHistory[] = [];

    for (const booking of bookingsData || []) {
      // Get charges for this booking
      const { data: charges } = await supabase
        .from('folio_charges')
        .select('amount')
        .eq('booking_id', booking.id);
      
      // Get payments for this booking
      const { data: payments } = await supabase
        .from('payments')
        .select('amount')
        .eq('booking_id', booking.id);

      // Get archived documents for this booking
      let archivedDocs: ArchivedDocument[] = [];
      try {
        archivedDocs = await getArchivedDocuments(booking.id);
      } catch {
        // Documents may not exist for old bookings
      }

      const totalCharges = charges?.reduce((sum, c) => sum + Number(c.amount), 0) || 0;
      const totalPayments = payments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
      
      totalSpend += totalPayments;

      historyWithTotals.push({
        ...booking,
        totalCharges,
        totalPayments,
        archivedDocs,
      });
    }

    setStayHistory(historyWithTotals);
    setGuestStats({
      totalStays: historyWithTotals.length,
      totalSpend,
      isVIP: historyWithTotals.length >= 3 || totalSpend >= 50000,
    });
    setLoadingHistory(false);
  };

  const handleInitiateCheckin = async (reservation: Reservation | null = null) => {
    setSelectedReservation(reservation);

    const roomTypeId = reservation?.room_types.id;
    const { data: roomsData } = await supabase
      .from('rooms')
      .select('*, room_types(*)')
      .eq('status', 'vacant_clean')
      .order('room_number');

    let filtered = roomsData || [];
    if (roomTypeId) {
      filtered = filtered.filter(r => r.room_type_id === roomTypeId);
    }

    setAvailableRooms(filtered as Room[] || []);
    setShowCheckinModal(true);
  };

  const handleCheckin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedGuest) return;

    const formData = new FormData(e.currentTarget);
    const roomId = formData.get('room_id') as string;
    const checkOutDate = formData.get('check_out_date') as string;
    const numberOfGuests = parseInt(formData.get('number_of_guests') as string);
    const advancePayment = parseFloat(formData.get('advance_payment') as string || '0');
    const idProofType = formData.get('id_proof_type') as string;
    const idProofNumber = formData.get('id_proof_number') as string;

    try {
      await supabase
        .from('guests')
        .update({
          id_proof_type: idProofType,
          id_proof_number: idProofNumber,
        })
        .eq('id', selectedGuest.id);

      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .insert([{
          reservation_id: selectedReservation?.id || null,
          guest_id: selectedGuest.id,
          room_id: roomId,
          check_in_date: new Date().toISOString(),
          expected_check_out_date: checkOutDate,
          number_of_guests: numberOfGuests,
          advance_payment: advancePayment,
          checked_in_by: user?.id,
          status: 'checked_in',
        }])
        .select()
        .single();

      if (bookingError) throw bookingError;

      await supabase
        .from('rooms')
        .update({ status: 'occupied' })
        .eq('id', roomId);

      if (selectedReservation) {
        await supabase
          .from('reservations')
          .update({ status: 'checked_in' })
          .eq('id', selectedReservation.id);
      }

      const selectedRoom = availableRooms.find(r => r.id === roomId);
      if (selectedRoom) {
        const nights = Math.ceil(
          (new Date(checkOutDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
        );

        for (let i = 0; i < nights; i++) {
          const chargeDate = new Date();
          chargeDate.setDate(chargeDate.getDate() + i);

          await supabase.from('folio_charges').insert([{
            booking_id: booking.id,
            charge_date: chargeDate.toISOString().split('T')[0],
            description: `Room Rent - ${selectedRoom.room_types.name} (Night ${i + 1})`,
            amount: selectedRoom.room_types.base_rate,
            charge_type: 'room_rent',
            posted_by: user?.id,
          }]);
        }
      }

      if (advancePayment > 0) {
        await supabase.from('payments').insert([{
          booking_id: booking.id,
          payment_date: new Date().toISOString(),
          amount: advancePayment,
          payment_mode: 'cash',
          received_by: user?.id,
        }]);
      }

      setShowCheckinModal(false);
      setSelectedGuest(null);
      setSelectedReservation(null);
      alert('Check-in completed successfully!');
    } catch (error: unknown) {
      const err = error as { message?: string };
      alert('Error during check-in: ' + (err.message || 'Unknown error'));
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Loading guests...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Guests</h1>
          <p className="text-gray-600">View guest records and perform check-ins</p>
        </div>

        <div className="bg-white rounded-lg shadow mb-6">
          <div className="p-4 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search by name or mobile number..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mobile</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID Proof</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredGuests.map((guest) => (
                  <tr key={guest.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <User className="w-5 h-5 text-gray-400 mr-2" />
                        <span className="text-sm font-medium text-gray-800">{guest.full_name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm text-gray-600">
                        <Phone className="w-4 h-4 mr-1" />
                        {guest.mobile}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {guest.email || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {guest.id_proof_number ? (
                        <span className="capitalize">{guest.id_proof_type}: {guest.id_proof_number}</span>
                      ) : (
                        <span className="text-red-600">Not provided</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      <button
                        onClick={() => handleSelectGuest(guest)}
                        className="text-blue-600 hover:text-blue-800 font-medium"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredGuests.length === 0 && (
            <div className="text-center py-12">
              <User className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600">No guests found</p>
            </div>
          )}
        </div>
      </div>

      {selectedGuest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6">
            <h3 className="text-2xl font-bold text-gray-800 mb-4">Guest Details</h3>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <p className="text-sm text-gray-600">Name</p>
                <p className="font-medium text-gray-800">{selectedGuest.full_name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Mobile</p>
                <p className="font-medium text-gray-800">{selectedGuest.mobile}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Email</p>
                <p className="font-medium text-gray-800">{selectedGuest.email || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Address</p>
                <p className="font-medium text-gray-800">{selectedGuest.address || '-'}</p>
              </div>
            </div>

            {reservations.length > 0 && (
              <div className="mb-6">
                <h4 className="font-semibold text-gray-800 mb-3">Active Reservations</h4>
                <div className="space-y-2">
                  {reservations.map((reservation) => (
                    <div key={reservation.id} className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                      <div className="flex items-center">
                        <Calendar className="w-5 h-5 text-green-600 mr-3" />
                        <div>
                          <p className="font-medium text-gray-800">{reservation.room_types.name}</p>
                          <p className="text-sm text-gray-600">
                            {new Date(reservation.check_in_date).toLocaleDateString()} - {new Date(reservation.check_out_date).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleInitiateCheckin(reservation)}
                        className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                      >
                        <LogIn className="w-4 h-4 mr-2" />
                        Check In
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Guest Stats & VIP Badge */}
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-4">
                {guestStats.isVIP && (
                  <div className="flex items-center gap-1 px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">
                    <Star className="w-4 h-4" />
                    VIP Guest
                  </div>
                )}
                {guestStats.totalStays > 0 && (
                  <div className="flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                    <Award className="w-4 h-4" />
                    {guestStats.totalStays} {guestStats.totalStays === 1 ? 'Stay' : 'Stays'}
                  </div>
                )}
              </div>
              
              {guestStats.totalStays > 0 && (
                <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-sm text-gray-600">Total Stays</p>
                    <p className="text-xl font-bold text-gray-800">{guestStats.totalStays}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Total Spend</p>
                    <p className="text-xl font-bold text-green-600 flex items-center">
                      <IndianRupee className="w-5 h-5" />
                      {guestStats.totalSpend.toLocaleString('en-IN')}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Stay History */}
            {loadingHistory ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                <span className="ml-2 text-gray-600">Loading history...</span>
              </div>
            ) : stayHistory.length > 0 && (
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-gray-800 flex items-center gap-2">
                    <History className="w-5 h-5 text-gray-600" />
                    Stay History
                  </h4>
                  <button
                    onClick={() => setShowExportModal(true)}
                    className="flex items-center text-sm px-3 py-1 text-purple-600 hover:bg-purple-50 rounded-lg transition"
                  >
                    <Download className="w-4 h-4 mr-1" />
                    Export All Data
                  </button>
                </div>
                <div className="max-h-64 overflow-y-auto space-y-3">
                  {stayHistory.map((stay) => (
                    <div key={stay.id} className="p-3 bg-gray-50 rounded-lg border">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center">
                          <div className={`w-2 h-2 rounded-full mr-3 ${
                            stay.status === 'checked_in' ? 'bg-green-500' : 'bg-gray-400'
                          }`}></div>
                          <div>
                            <p className="font-medium text-gray-800">
                              Room {stay.rooms.room_number} - {stay.rooms.room_types.name}
                            </p>
                            <p className="text-sm text-gray-600">
                              {new Date(stay.check_in_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                              {stay.actual_check_out_date && (
                                <> → {new Date(stay.actual_check_out_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</>
                              )}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-gray-800">₹{stay.totalPayments.toLocaleString('en-IN')}</p>
                          <p className={`text-xs ${stay.status === 'checked_in' ? 'text-green-600' : 'text-gray-500'}`}>
                            {stay.status === 'checked_in' ? 'Current' : 'Completed'}
                          </p>
                        </div>
                      </div>
                      {/* Document Buttons */}
                      {stay.archivedDocs.length > 0 && (
                        <div className="flex gap-2 mt-2 pt-2 border-t border-gray-200">
                          {stay.archivedDocs.map((doc) => (
                            <button
                              key={doc.id}
                              onClick={() => setSelectedDocument(doc)}
                              className="flex items-center text-xs px-2 py-1 bg-white border border-gray-300 rounded hover:bg-gray-100 transition"
                            >
                              <FileText className="w-3 h-3 mr-1 text-blue-600" />
                              {doc.document_type === 'invoice' ? 'Invoice' : 'GRC'}
                            </button>
                          ))}
                          <span className="text-xs text-green-600 flex items-center ml-auto">
                            ✓ Archived
                          </span>
                        </div>
                      )}
                      {stay.status === 'checked_out' && stay.archivedDocs.length === 0 && (
                        <p className="text-xs text-orange-500 mt-2 pt-2 border-t border-gray-200">
                          ⚠ No archived documents (checked out before archival feature)
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setSelectedGuest(null)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Close
              </button>
              <button
                onClick={() => handleInitiateCheckin(null)}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Walk-In Check In
              </button>
            </div>
          </div>
        </div>
      )}

      {showCheckinModal && selectedGuest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6 my-8">
            <h3 className="text-2xl font-bold text-gray-800 mb-6">Check In - {selectedGuest.full_name}</h3>
            <form onSubmit={handleCheckin}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {!selectedGuest.id_proof_number && (
                  <>
                    <div className="md:col-span-2">
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                        <p className="text-sm text-yellow-800">ID proof details are required for check-in</p>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">ID Proof Type *</label>
                      <select
                        name="id_proof_type"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        required
                      >
                        <option value="aadhaar">Aadhaar Card</option>
                        <option value="passport">Passport</option>
                        <option value="driving_license">Driving License</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">ID Proof Number *</label>
                      <input
                        type="text"
                        name="id_proof_number"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Select Room *</label>
                  <select
                    name="room_id"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Select Room</option>
                    {availableRooms.map((room) => (
                      <option key={room.id} value={room.id}>
                        {room.room_number} - {room.room_types.name} (₹{room.room_types.base_rate}/night)
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Number of Guests *</label>
                  <input
                    type="number"
                    name="number_of_guests"
                    min="1"
                    defaultValue={selectedReservation?.number_of_guests || 1}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Expected Check-Out Date *</label>
                  <input
                    type="date"
                    name="check_out_date"
                    min={new Date().toISOString().split('T')[0]}
                    defaultValue={selectedReservation?.check_out_date}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Advance Payment (₹)</label>
                  <input
                    type="number"
                    name="advance_payment"
                    step="0.01"
                    defaultValue="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowCheckinModal(false);
                    setSelectedReservation(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Complete Check-In
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Document Viewer Modal */}
      {selectedDocument && (
        <DocumentViewer
          document={selectedDocument}
          onClose={() => setSelectedDocument(null)}
        />
      )}

      {/* Export Data Modal */}
      {showExportModal && selectedGuest && (
        <ExportDataModal
          guestId={selectedGuest.id}
          guestName={selectedGuest.full_name}
          onClose={() => setShowExportModal(false)}
        />
      )}
    </Layout>
  );
}
