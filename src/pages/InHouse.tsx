import { useState, useEffect } from 'react';
import { Plus, Receipt, LogOut, Calendar, CalendarPlus, ArrowRightLeft, X } from 'lucide-react';
import Layout from '../components/Layout';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import Invoice from '../components/Invoice';
import GRC from '../components/GRC';
import PrintDocument from '../components/PrintDocument';
import { archiveInvoice, archiveGRC } from '../lib/documentArchiveService';
import { useFrontDeskSync, useFolioSync } from '../hooks/useRealtimeSync';

interface Booking {
  id: string;
  check_in_date: string;
  expected_check_out_date: string;
  number_of_guests: number;
  advance_payment: number;
  guests: {
    full_name: string;
    mobile: string;
    email?: string;
    address?: string;
    id_proof_type?: string;
    id_proof_number?: string;
  };
  rooms: {
    id: string;
    room_number: string;
    room_types: {
      name: string;
      base_rate: number;
    };
  };
}

interface FolioCharge {
  id: string;
  charge_date: string;
  description: string;
  amount: number;
  charge_type: string;
}

interface Payment {
  id: string;
  payment_date: string;
  amount: number;
  payment_mode: string;
}

export default function InHouse() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [folioCharges, setFolioCharges] = useState<FolioCharge[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [showChargeModal, setShowChargeModal] = useState(false);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [showExtendModal, setShowExtendModal] = useState(false);
  const [showRoomChangeModal, setShowRoomChangeModal] = useState(false);
  const [showInvoicePreview, setShowInvoicePreview] = useState(false);
  const [checkoutPaymentData, setCheckoutPaymentData] = useState<{ amount: number; mode: string } | null>(null);
  const [availableRooms, setAvailableRooms] = useState<{ id: string; room_number: string; room_types: { name: string } | null }[]>([]);
  const [taxes, setTaxes] = useState<{ cgst: number; sgst: number }>({ cgst: 6, sgst: 6 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBookings();
    loadTaxes();
  }, []);

  const loadTaxes = async () => {
    const { data } = await supabase
      .from('tax_config')
      .select('*')
      .eq('is_active', true);

    const cgst = data?.find(t => t.tax_name === 'CGST');
    const sgst = data?.find(t => t.tax_name === 'SGST');

    setTaxes({
      cgst: cgst?.tax_percentage || 6,
      sgst: sgst?.tax_percentage || 6,
    });
  };

  const loadBookings = async () => {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('*, guests(*), rooms(*, room_types(*))')
        .eq('status', 'checked_in')
        .order('check_in_date', { ascending: false });

      if (error) throw error;
      setBookings(data as Booking[] || []);
    } catch (error) {
      console.error('Error loading bookings:', error);
    } finally {
      setLoading(false);
    }
  };

  // Real-time sync - in-house list updates when any device makes changes
  useFrontDeskSync(loadBookings);
  useFolioSync(() => {
    if (selectedBooking) loadFolioAndPayments(selectedBooking.id);
  });

  const loadFolioAndPayments = async (bookingId: string) => {
    const { data: charges } = await supabase
      .from('folio_charges')
      .select('*')
      .eq('booking_id', bookingId)
      .order('charge_date');

    const { data: paymentsData } = await supabase
      .from('payments')
      .select('*')
      .eq('booking_id', bookingId)
      .order('payment_date');

    setFolioCharges(charges || []);
    setPayments(paymentsData || []);
  };

  const handleViewFolio = (booking: Booking) => {
    setSelectedBooking(booking);
    loadFolioAndPayments(booking.id);
  };

  const handleAddCharge = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedBooking) return;

    const formData = new FormData(e.currentTarget);
    const chargeData = {
      booking_id: selectedBooking.id,
      charge_date: formData.get('charge_date') as string,
      description: formData.get('description') as string,
      amount: parseFloat(formData.get('amount') as string),
      charge_type: formData.get('charge_type') as string,
      posted_by: user?.id,
    };

    await supabase.from('folio_charges').insert([chargeData]);
    loadFolioAndPayments(selectedBooking.id);
    setShowChargeModal(false);
  };

  const calculateFolioTotal = () => {
    const totalCharges = folioCharges.reduce((sum, charge) => sum + Number(charge.amount), 0);
    const totalPayments = payments.reduce((sum, payment) => sum + Number(payment.amount), 0);

    const subtotal = totalCharges;
    const cgstAmount = (subtotal * taxes.cgst) / 100;
    const sgstAmount = (subtotal * taxes.sgst) / 100;
    const grandTotal = subtotal + cgstAmount + sgstAmount;
    const balance = grandTotal - totalPayments;

    return { subtotal, cgstAmount, sgstAmount, grandTotal, totalPayments, balance };
  };

  // Step 1: Show invoice preview before checkout
  const handleCheckout = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedBooking) return;

    const formData = new FormData(e.currentTarget);
    const paymentAmount = parseFloat(formData.get('payment_amount') as string) || 0;
    const paymentMode = formData.get('payment_mode') as string;

    // Save payment data for later
    setCheckoutPaymentData({ amount: paymentAmount, mode: paymentMode });
    
    // Close checkout modal and show invoice preview
    setShowCheckoutModal(false);
    setShowInvoicePreview(true);
  };

  // Step 2: Complete checkout after printing invoice
  const confirmCheckout = async () => {
    if (!selectedBooking) return;

    try {
      // Add final payment if any
      if (checkoutPaymentData && checkoutPaymentData.amount > 0) {
        await supabase.from('payments').insert([{
          booking_id: selectedBooking.id,
          payment_date: new Date().toISOString(),
          amount: checkoutPaymentData.amount,
          payment_mode: checkoutPaymentData.mode,
          received_by: user?.id,
        }]);
      }

      // Reload folio data to include final payment
      const { data: finalCharges } = await supabase
        .from('folio_charges')
        .select('*')
        .eq('booking_id', selectedBooking.id);
      
      const { data: finalPayments } = await supabase
        .from('payments')
        .select('*')
        .eq('booking_id', selectedBooking.id);

      // Get guest ID from the booking for document archival
      const { data: bookingData } = await supabase
        .from('bookings')
        .select('guest_id')
        .eq('id', selectedBooking.id)
        .single();

      if (bookingData) {
        const archiveBooking = {
          ...selectedBooking,
          guests: {
            ...selectedBooking.guests,
            id: bookingData.guest_id,
          },
        };

        // Archive Invoice (with all charges and payments)
        await archiveInvoice(
          archiveBooking,
          finalCharges || [],
          finalPayments || [],
          taxes
        );

        // Archive GRC
        await archiveGRC(archiveBooking, taxes);
      }

      // Update booking status
      await supabase
        .from('bookings')
        .update({
          status: 'checked_out',
          actual_check_out_date: new Date().toISOString(),
          checked_out_by: user?.id,
        })
        .eq('id', selectedBooking.id);

      // Mark room as vacant dirty
      await supabase
        .from('rooms')
        .update({ status: 'vacant_dirty' })
        .eq('id', selectedBooking.rooms.id);

      setShowInvoicePreview(false);
      setCheckoutPaymentData(null);
      setSelectedBooking(null);
      loadBookings();
      alert('Check-out completed successfully! Invoice and GRC have been archived.');
    } catch (error: unknown) {
      const err = error as { message?: string };
      alert('Error during checkout: ' + (err.message || 'Unknown error'));
    }
  };

  const handleExtendStay = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedBooking) return;

    const formData = new FormData(e.currentTarget);
    const newCheckoutDate = formData.get('new_checkout_date') as string;

    try {
      // Calculate additional nights
      const currentCheckout = new Date(selectedBooking.expected_check_out_date);
      const newCheckout = new Date(newCheckoutDate);
      const additionalNights = Math.ceil((newCheckout.getTime() - currentCheckout.getTime()) / (1000 * 60 * 60 * 24));

      if (additionalNights > 0) {
        // Add room charges for additional nights
        for (let i = 0; i < additionalNights; i++) {
          const chargeDate = new Date(currentCheckout);
          chargeDate.setDate(currentCheckout.getDate() + i);

          await supabase.from('folio_charges').insert([{
            booking_id: selectedBooking.id,
            charge_date: chargeDate.toISOString().split('T')[0],
            description: `Room Rent - ${selectedBooking.rooms.room_types.name} (Extended)`,
            amount: selectedBooking.rooms.room_types.base_rate,
            charge_type: 'room_rent',
            posted_by: user?.id,
          }]);
        }
      }

      // Update booking checkout date
      await supabase
        .from('bookings')
        .update({ expected_check_out_date: newCheckoutDate })
        .eq('id', selectedBooking.id);

      setShowExtendModal(false);
      loadFolioAndPayments(selectedBooking.id);
      loadBookings();
      alert(`Stay extended by ${additionalNights} night(s). Room charges added.`);
    } catch (error: unknown) {
      const err = error as { message?: string };
      alert('Error extending stay: ' + (err.message || 'Unknown error'));
    }
  };

  const loadAvailableRooms = async () => {
    const { data } = await supabase
      .from('rooms')
      .select('id, room_number, room_types(name)')
      .eq('status', 'vacant_clean')
      .order('room_number');

    // Transform data to match expected type - Supabase returns room_types as array
    const transformedData = (data || []).map(room => ({
      id: room.id as string,
      room_number: room.room_number as string,
      room_types: Array.isArray(room.room_types) 
        ? (room.room_types[0] as { name: string } | undefined) || null
        : (room.room_types as { name: string } | null),
    }));

    setAvailableRooms(transformedData);
  };

  const handleRoomChange = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedBooking) return;

    const formData = new FormData(e.currentTarget);
    const newRoomId = formData.get('new_room_id') as string;

    try {
      // Mark old room as vacant dirty
      await supabase
        .from('rooms')
        .update({ status: 'vacant_dirty' })
        .eq('id', selectedBooking.rooms.id);

      // Mark new room as occupied
      await supabase
        .from('rooms')
        .update({ status: 'occupied' })
        .eq('id', newRoomId);

      // Update booking with new room
      await supabase
        .from('bookings')
        .update({ room_id: newRoomId })
        .eq('id', selectedBooking.id);

      setShowRoomChangeModal(false);
      setSelectedBooking(null);
      loadBookings();
      alert('Room changed successfully!');
    } catch (error: unknown) {
      const err = error as { message?: string };
      alert('Error changing room: ' + (err.message || 'Unknown error'));
    }
  };

  const getDaysStayed = (checkInDate: string) => {
    const checkIn = new Date(checkInDate);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - checkIn.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays || 1;
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Loading in-house guests...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">In-House Guests</h1>
          <p className="text-gray-600">Manage active bookings and guest folios</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow">
              <div className="p-4 border-b">
                <h2 className="font-semibold text-gray-800">Active Bookings ({bookings.length})</h2>
              </div>
              <div className="divide-y max-h-[600px] overflow-y-auto">
                {bookings.map((booking) => (
                  <button
                    key={booking.id}
                    onClick={() => handleViewFolio(booking)}
                    className={`w-full p-4 text-left hover:bg-gray-50 transition ${
                      selectedBooking?.id === booking.id ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-medium text-gray-800">{booking.guests.full_name}</p>
                        <p className="text-sm text-gray-600">{booking.guests.mobile}</p>
                      </div>
                      <span className="text-lg font-bold text-blue-600">
                        {booking.rooms.room_number}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>{booking.rooms.room_types.name}</span>
                      <span>Day {getDaysStayed(booking.check_in_date)}</span>
                    </div>
                  </button>
                ))}
                {bookings.length === 0 && (
                  <div className="p-8 text-center text-gray-500">
                    <p>No in-house guests</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="lg:col-span-2">
            {selectedBooking ? (
              <div className="bg-white rounded-lg shadow">
                <div className="p-6 border-b">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-800">{selectedBooking.guests.full_name}</h2>
                      <p className="text-gray-600">Room {selectedBooking.rooms.room_number} - {selectedBooking.rooms.room_types.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-600">Check-In</p>
                      <p className="font-medium">
                        {new Date(selectedBooking.check_in_date).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={() => setShowChargeModal(true)}
                      className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Charge
                    </button>
                    <PrintDocument
                      title={`Invoice - ${selectedBooking.guests.full_name}`}
                      buttonText="Print Invoice"
                      buttonClassName="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
                    >
                      <Invoice
                        booking={selectedBooking}
                        folioCharges={folioCharges}
                        payments={payments}
                        taxes={taxes}
                      />
                    </PrintDocument>
                    <PrintDocument
                      title={`GRC - ${selectedBooking.guests.full_name}`}
                      buttonText="Print GRC"
                      buttonClassName="flex items-center px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition"
                    >
                      <GRC booking={selectedBooking} />
                    </PrintDocument>
                    <button
                      onClick={() => setShowExtendModal(true)}
                      className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
                    >
                      <CalendarPlus className="w-4 h-4 mr-2" />
                      Extend Stay
                    </button>
                    <button
                      onClick={() => {
                        loadAvailableRooms();
                        setShowRoomChangeModal(true);
                      }}
                      className="flex items-center px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition"
                    >
                      <ArrowRightLeft className="w-4 h-4 mr-2" />
                      Change Room
                    </button>
                    <button
                      onClick={() => setShowCheckoutModal(true)}
                      className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                    >
                      <LogOut className="w-4 h-4 mr-2" />
                      Check Out
                    </button>
                  </div>
                </div>

                <div className="p-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                    <Receipt className="w-5 h-5 mr-2" />
                    Guest Folio
                  </h3>

                  <div className="overflow-x-auto mb-6">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Date</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Description</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {folioCharges.map((charge) => (
                          <tr key={charge.id}>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {new Date(charge.charge_date).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-800">{charge.description}</td>
                            <td className="px-4 py-3 text-sm text-gray-800 text-right">₹{charge.amount.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="border-t pt-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Subtotal</span>
                      <span className="font-medium">₹{calculateFolioTotal().subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">CGST ({taxes.cgst}%)</span>
                      <span className="font-medium">₹{calculateFolioTotal().cgstAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">SGST ({taxes.sgst}%)</span>
                      <span className="font-medium">₹{calculateFolioTotal().sgstAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-lg font-bold border-t pt-2">
                      <span>Grand Total</span>
                      <span>₹{calculateFolioTotal().grandTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-green-600">
                      <span>Total Paid</span>
                      <span className="font-medium">₹{calculateFolioTotal().totalPayments.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-lg font-bold text-red-600">
                      <span>Balance Due</span>
                      <span>₹{calculateFolioTotal().balance.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow p-12 text-center">
                <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600">Select a booking to view folio details</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {showChargeModal && selectedBooking && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Add Charge</h3>
            <form onSubmit={handleAddCharge}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <input
                    type="date"
                    name="charge_date"
                    defaultValue={new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Charge Type</label>
                  <select
                    name="charge_type"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="room_rent">Room Rent</option>
                    <option value="extra_bed">Extra Bed</option>
                    <option value="early_checkin">Early Check-in</option>
                    <option value="late_checkout">Late Check-out</option>
                    <option value="miscellaneous">Miscellaneous</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <input
                    type="text"
                    name="description"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount (₹)</label>
                  <input
                    type="number"
                    name="amount"
                    step="0.01"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowChargeModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Add Charge
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCheckoutModal && selectedBooking && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Check Out</h3>
            <div className="bg-gray-50 p-4 rounded-lg mb-4">
              <div className="flex justify-between mb-2">
                <span className="text-gray-600">Total Amount:</span>
                <span className="font-bold text-lg">₹{calculateFolioTotal().grandTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between mb-2">
                <span className="text-gray-600">Paid:</span>
                <span className="text-green-600 font-medium">₹{calculateFolioTotal().totalPayments.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold border-t pt-2 mt-2">
                <span>Balance Due:</span>
                <span className="text-red-600">₹{calculateFolioTotal().balance.toFixed(2)}</span>
              </div>
            </div>
            <form onSubmit={handleCheckout}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Payment Amount (₹)</label>
                  <input
                    type="number"
                    name="payment_amount"
                    step="0.01"
                    defaultValue={Math.max(0, calculateFolioTotal().balance).toFixed(2)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Payment Mode</label>
                  <select
                    name="payment_mode"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="cash">Cash</option>
                    <option value="upi">UPI</option>
                    <option value="card">Card</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowCheckoutModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Complete Check-Out
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Extend Stay Modal */}
      {showExtendModal && selectedBooking && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-800">Extend Stay</h3>
              <button
                onClick={() => setShowExtendModal(false)}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg mb-4">
              <p className="text-sm text-blue-800">
                <strong>{selectedBooking.guests.full_name}</strong> - Room {selectedBooking.rooms.room_number}
              </p>
              <p className="text-xs text-blue-600">
                Current checkout: {new Date(selectedBooking.expected_check_out_date).toLocaleDateString('en-IN')}
              </p>
            </div>
            <form onSubmit={handleExtendStay}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  New Check-Out Date *
                </label>
                <input
                  type="date"
                  name="new_checkout_date"
                  min={new Date(selectedBooking.expected_check_out_date).toISOString().split('T')[0]}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Room charges will be added for additional nights
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowExtendModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  Extend Stay
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Room Change Modal */}
      {showRoomChangeModal && selectedBooking && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-800">Change Room</h3>
              <button
                onClick={() => setShowRoomChangeModal(false)}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="bg-yellow-50 p-4 rounded-lg mb-4">
              <p className="text-sm text-yellow-800">
                <strong>{selectedBooking.guests.full_name}</strong>
              </p>
              <p className="text-xs text-yellow-600">
                Current room: {selectedBooking.rooms.room_number} ({selectedBooking.rooms.room_types.name})
              </p>
            </div>
            <form onSubmit={handleRoomChange}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  New Room *
                </label>
                <select
                  name="new_room_id"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                >
                  <option value="">Select Room</option>
                  {availableRooms.map((room) => (
                    <option key={room.id} value={room.id}>
                      {room.room_number} - {room.room_types?.name || 'Unknown'}
                    </option>
                  ))}
                </select>
                {availableRooms.length === 0 && (
                  <p className="text-xs text-red-500 mt-1">
                    No vacant clean rooms available
                  </p>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowRoomChangeModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={availableRooms.length === 0}
                  className="flex-1 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50"
                >
                  Change Room
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invoice Preview Modal - Shows before final checkout */}
      {showInvoicePreview && selectedBooking && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[95vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b bg-blue-50">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-gray-800">📄 Invoice Preview</h3>
                  <p className="text-sm text-blue-700">Please print the invoice before completing checkout</p>
                </div>
                <button
                  onClick={() => {
                    setShowInvoicePreview(false);
                    setCheckoutPaymentData(null);
                  }}
                  className="p-2 hover:bg-blue-100 rounded-full"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-auto p-6 bg-gray-100">
              <PrintDocument title={`Invoice - ${selectedBooking.guests.full_name}`}>
                <Invoice
                  booking={selectedBooking}
                  folioCharges={folioCharges}
                  payments={payments}
                  taxes={taxes}
                />
              </PrintDocument>
            </div>

            <div className="p-4 border-t bg-gray-50 flex gap-3">
              <button
                onClick={() => {
                  setShowInvoicePreview(false);
                  setShowCheckoutModal(true);
                  setCheckoutPaymentData(null);
                }}
                className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100"
              >
                ← Back to Checkout
              </button>
              <button
                onClick={confirmCheckout}
                className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-bold"
              >
                ✓ Complete Checkout
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
