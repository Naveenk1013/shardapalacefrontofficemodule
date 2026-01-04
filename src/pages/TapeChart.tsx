import { useState, useEffect, useMemo, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Calendar, X, User, Phone, Clock, Layers, Plus, ChevronDown, ChevronUp, CalendarDays, CalendarRange } from 'lucide-react';
import Layout from '../components/Layout';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useFrontDeskSync } from '../hooks/useRealtimeSync';

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

interface Booking {
  id: string;
  check_in_date: string;
  expected_check_out_date: string;
  actual_check_out_date: string | null;
  status: string;
  number_of_guests: number;
  room_id: string;
  guests: {
    id: string;
    full_name: string;
    mobile: string;
  };
  rooms: {
    room_number: string;
  };
}

interface Reservation {
  id: string;
  check_in_date: string;
  check_out_date: string;
  status: string;
  number_of_guests: number;
  room_type_id: string;
  assigned_room_id?: string;
  guests: {
    id: string;
    full_name: string;
    mobile: string;
  };
  room_types: {
    id: string;
    name: string;
  };
}

interface RoomTypeGroup {
  id: string;
  name: string;
  rooms: Room[];
  isExpanded: boolean;
}

interface OccupancyData {
  date: string;
  occupied: number;
  total: number;
  percentage: number;
}

type ViewMode = '14days' | '30days';

export default function TapeChart() {
  const { user } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [startDate, setStartDate] = useState(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  });
  const [loading, setLoading] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('14days');
  const [roomTypeGroups, setRoomTypeGroups] = useState<RoomTypeGroup[]>([]);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showNewReservationModal, setShowNewReservationModal] = useState(false);
  const [newReservationData, setNewReservationData] = useState<{
    roomId: string;
    roomNumber: string;
    roomTypeName: string;
    date: Date;
  } | null>(null);
  
  const DAYS_TO_SHOW = viewMode === '14days' ? 14 : 30;

  // Generate array of dates for the header
  const dateRange = useMemo(() => {
    const dates: Date[] = [];
    for (let i = 0; i < DAYS_TO_SHOW; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      dates.push(date);
    }
    return dates;
  }, [startDate, DAYS_TO_SHOW]);

  // Calculate occupancy data per day
  const occupancyData = useMemo((): OccupancyData[] => {
    return dateRange.map(date => {
      const dateStr = date.toISOString().split('T')[0];
      let occupied = 0;

      rooms.forEach(room => {
        // Check bookings
        const hasBooking = bookings.some(booking => {
          if (booking.room_id !== room.id) return false;
          const checkIn = new Date(booking.check_in_date).toISOString().split('T')[0];
          const checkOut = booking.actual_check_out_date 
            ? new Date(booking.actual_check_out_date).toISOString().split('T')[0]
            : new Date(booking.expected_check_out_date).toISOString().split('T')[0];
          return dateStr >= checkIn && dateStr < checkOut;
        });

        // Check reservations with assigned room
        const hasReservation = reservations.some(res => {
          if (res.assigned_room_id !== room.id) return false;
          const checkIn = res.check_in_date;
          const checkOut = res.check_out_date;
          return dateStr >= checkIn && dateStr < checkOut;
        });

        if (hasBooking || hasReservation) occupied++;
      });

      return {
        date: dateStr,
        occupied,
        total: rooms.length,
        percentage: rooms.length > 0 ? Math.round((occupied / rooms.length) * 100) : 0
      };
    });
  }, [dateRange, rooms, bookings, reservations]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Load rooms
      const { data: roomsData } = await supabase
        .from('rooms')
        .select('*, room_types(*)')
        .order('room_number');

      // Calculate date range for query
      const endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + DAYS_TO_SHOW);

      // Load bookings in date range
      const { data: bookingsData } = await supabase
        .from('bookings')
        .select('*, guests(*), rooms(*)')
        .or(`check_in_date.lte.${endDate.toISOString()},expected_check_out_date.gte.${startDate.toISOString()}`);

      // Load reservations (confirmed only) in date range
      const { data: reservationsData } = await supabase
        .from('reservations')
        .select('*, guests(*), room_types(*)')
        .eq('status', 'confirmed')
        .or(`check_in_date.lte.${endDate.toISOString().split('T')[0]},check_out_date.gte.${startDate.toISOString().split('T')[0]}`);

      const typedRooms = roomsData || [];
      setRooms(typedRooms);
      setBookings(bookingsData || []);
      setReservations(reservationsData || []);

      // Group rooms by type
      const groups: Record<string, RoomTypeGroup> = {};
      typedRooms.forEach(room => {
        const typeId = room.room_types.id;
        if (!groups[typeId]) {
          groups[typeId] = {
            id: typeId,
            name: room.room_types.name,
            rooms: [],
            isExpanded: true
          };
        }
        groups[typeId].rooms.push(room);
      });
      setRoomTypeGroups(Object.values(groups));

    } catch (error) {
      console.error('Error loading tape chart data:', error);
    } finally {
      setLoading(false);
    }
  }, [startDate, DAYS_TO_SHOW]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Real-time sync - tape chart updates when any device makes changes
  useFrontDeskSync(loadData);

  const navigateWeek = (direction: 'prev' | 'next') => {
    const days = viewMode === '14days' ? 7 : 14;
    const newDate = new Date(startDate);
    newDate.setDate(startDate.getDate() + (direction === 'next' ? days : -days));
    setStartDate(newDate);
  };

  const goToToday = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    setStartDate(today);
  };

  const goToDate = (dateStr: string) => {
    const date = new Date(dateStr);
    date.setHours(0, 0, 0, 0);
    setStartDate(date);
    setShowDatePicker(false);
  };

  const toggleRoomTypeGroup = (typeId: string) => {
    setRoomTypeGroups(prev => prev.map(group => 
      group.id === typeId ? { ...group, isExpanded: !group.isExpanded } : group
    ));
  };

  // Get booking for a specific room on a specific date
  const getBookingForCell = (roomId: string, date: Date): Booking | null => {
    const dateStr = date.toISOString().split('T')[0];
    
    return bookings.find(booking => {
      if (booking.room_id !== roomId) return false;
      
      const checkIn = new Date(booking.check_in_date).toISOString().split('T')[0];
      const checkOut = booking.actual_check_out_date 
        ? new Date(booking.actual_check_out_date).toISOString().split('T')[0]
        : new Date(booking.expected_check_out_date).toISOString().split('T')[0];
      
      return dateStr >= checkIn && dateStr < checkOut;
    }) || null;
  };

  // Get reservation for a specific room on a specific date
  const getReservationForCell = (roomId: string, roomTypeId: string, date: Date): Reservation | null => {
    const dateStr = date.toISOString().split('T')[0];
    
    return reservations.find(res => {
      // Check if reservation is for this specific room (assigned) or for this room type
      if (res.assigned_room_id && res.assigned_room_id !== roomId) return false;
      if (!res.assigned_room_id && res.room_type_id !== roomTypeId) return false;
      
      const checkIn = res.check_in_date;
      const checkOut = res.check_out_date;
      
      return dateStr >= checkIn && dateStr < checkOut;
    }) || null;
  };

  // Check if this cell is the start of a booking
  const isBookingStart = (booking: Booking, date: Date): boolean => {
    const checkIn = new Date(booking.check_in_date).toISOString().split('T')[0];
    const dateStr = date.toISOString().split('T')[0];
    return checkIn === dateStr;
  };

  // Check if this cell is the start of a reservation
  const isReservationStart = (reservation: Reservation, date: Date): boolean => {
    const checkIn = reservation.check_in_date;
    const dateStr = date.toISOString().split('T')[0];
    return checkIn === dateStr;
  };

  // Calculate booking span (number of days visible)
  const getBookingSpan = (booking: Booking, startCellDate: Date): number => {
    const checkOut = booking.actual_check_out_date 
      ? new Date(booking.actual_check_out_date)
      : new Date(booking.expected_check_out_date);
    
    let span = 0;
    const currentDate = new Date(startCellDate);
    
    while (currentDate < checkOut && span < DAYS_TO_SHOW) {
      const dateIndex = dateRange.findIndex(d => 
        d.toISOString().split('T')[0] === currentDate.toISOString().split('T')[0]
      );
      if (dateIndex === -1) break;
      span++;
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return span;
  };

  // Calculate reservation span
  const getReservationSpan = (reservation: Reservation, startCellDate: Date): number => {
    const checkOut = new Date(reservation.check_out_date);
    
    let span = 0;
    const currentDate = new Date(startCellDate);
    
    while (currentDate < checkOut && span < DAYS_TO_SHOW) {
      const dateIndex = dateRange.findIndex(d => 
        d.toISOString().split('T')[0] === currentDate.toISOString().split('T')[0]
      );
      if (dateIndex === -1) break;
      span++;
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return span;
  };

  // Get color based on booking status
  const getBookingColor = (booking: Booking): string => {
    switch (booking.status) {
      case 'checked_in':
        return 'bg-emerald-500 hover:bg-emerald-600 border-l-4 border-emerald-700';
      case 'checked_out':
        return 'bg-slate-400 hover:bg-slate-500 border-l-4 border-slate-600';
      default:
        return 'bg-sky-500 hover:bg-sky-600 border-l-4 border-sky-700';
    }
  };

  // Get color for reservation
  const getReservationColor = (): string => {
    return 'bg-amber-400 hover:bg-amber-500 border-l-4 border-amber-600';
  };

  // Handle clicking on empty cell to create reservation
  const handleEmptyCellClick = (room: Room, date: Date) => {
    setNewReservationData({
      roomId: room.id,
      roomNumber: room.room_number,
      roomTypeName: room.room_types.name,
      date
    });
    setShowNewReservationModal(true);
  };

  // Handle creating new reservation
  const handleCreateReservation = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!newReservationData) return;

    const formData = new FormData(e.currentTarget);
    const guestName = formData.get('guest_name') as string;
    const guestMobile = formData.get('guest_mobile') as string;
    const nights = parseInt(formData.get('nights') as string) || 1;

    try {
      // Create guest if not exists
      const { data: existingGuest } = await supabase
        .from('guests')
        .select('id')
        .eq('mobile', guestMobile)
        .single();

      let guestId = existingGuest?.id;

      if (!guestId) {
        const { data: newGuest, error: guestError } = await supabase
          .from('guests')
          .insert([{ full_name: guestName, mobile: guestMobile }])
          .select()
          .single();
        
        if (guestError) throw guestError;
        guestId = newGuest?.id;
      }

      // Get room type and calculate checkout date
      const room = rooms.find(r => r.id === newReservationData.roomId);
      if (!room || !guestId) return;

      const checkOutDate = new Date(newReservationData.date);
      checkOutDate.setDate(checkOutDate.getDate() + nights);

      // Create reservation
      const { error: resError } = await supabase
        .from('reservations')
        .insert([{
          guest_id: guestId,
          room_type_id: room.room_types.id,
          assigned_room_id: room.id,
          check_in_date: newReservationData.date.toISOString().split('T')[0],
          check_out_date: checkOutDate.toISOString().split('T')[0],
          number_of_guests: 1,
          status: 'confirmed',
          created_by: user?.id
        }]);

      if (resError) throw resError;

      setShowNewReservationModal(false);
      setNewReservationData(null);
      loadData();
      alert('Reservation created successfully!');
    } catch (error) {
      console.error('Error creating reservation:', error);
      alert('Failed to create reservation. Please try again.');
    }
  };

  const isToday = (date: Date): boolean => {
    const today = new Date();
    return date.toISOString().split('T')[0] === today.toISOString().split('T')[0];
  };

  const isWeekend = (date: Date): boolean => {
    const day = date.getDay();
    return day === 0 || day === 6;
  };

  const getOccupancyColor = (percentage: number): string => {
    if (percentage >= 90) return 'text-red-600';
    if (percentage >= 70) return 'text-orange-600';
    if (percentage >= 50) return 'text-yellow-600';
    return 'text-green-600';
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Loading tape chart...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-full mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-800 mb-2">Tape Chart</h1>
              <p className="text-gray-600">Visual room availability calendar</p>
            </div>
            
            {/* Controls */}
            <div className="flex flex-wrap items-center gap-2">
              {/* View Toggle */}
              <div className="flex bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('14days')}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
                    viewMode === '14days' 
                      ? 'bg-white text-blue-600 shadow' 
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  <CalendarDays className="w-4 h-4 inline mr-1" />
                  2 Weeks
                </button>
                <button
                  onClick={() => setViewMode('30days')}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
                    viewMode === '30days' 
                      ? 'bg-white text-blue-600 shadow' 
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  <CalendarRange className="w-4 h-4 inline mr-1" />
                  Month
                </button>
              </div>

              {/* Navigation Controls */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => navigateWeek('prev')}
                  className="p-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={goToToday}
                  className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium"
                >
                  Today
                </button>
                <button
                  onClick={() => setShowDatePicker(true)}
                  className="p-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                >
                  <Calendar className="w-5 h-5" />
                </button>
                <button
                  onClick={() => navigateWeek('next')}
                  className="p-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex flex-wrap gap-6">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-emerald-500 border-l-2 border-emerald-700"></div>
              <span className="text-sm text-gray-600">Checked In</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-amber-400 border-l-2 border-amber-600"></div>
              <span className="text-sm text-gray-600">Confirmed Reservation</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-sky-500 border-l-2 border-sky-700"></div>
              <span className="text-sm text-gray-600">Pending</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-slate-400 border-l-2 border-slate-600"></div>
              <span className="text-sm text-gray-600">Checked Out</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-white border-2 border-gray-200"></div>
              <span className="text-sm text-gray-600">Available (Click to Reserve)</span>
            </div>
          </div>
        </div>

        {/* Tape Chart Grid */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse" style={{ minWidth: viewMode === '30days' ? '1800px' : '1000px' }}>
              <thead>
                <tr>
                  {/* Room Column Header */}
                  <th className="sticky left-0 z-20 bg-gray-800 text-white px-4 py-3 text-left font-semibold w-32 min-w-[120px]">
                    <div className="flex items-center gap-2">
                      <Layers className="w-4 h-4" />
                      Room
                    </div>
                  </th>
                  {/* Date Headers with Occupancy */}
                  {dateRange.map((date, index) => (
                    <th
                      key={index}
                      className={`px-1 py-2 text-center text-xs font-medium ${viewMode === '30days' ? 'min-w-[50px]' : 'min-w-[70px]'} ${
                        isToday(date)
                          ? 'bg-blue-600 text-white'
                          : isWeekend(date)
                          ? 'bg-gray-100 text-gray-700'
                          : 'bg-gray-800 text-white'
                      }`}
                    >
                      <div>{date.toLocaleDateString('en-IN', { weekday: 'short' }).charAt(0)}</div>
                      <div className={viewMode === '30days' ? 'text-sm' : 'text-lg'}>{date.getDate()}</div>
                      {viewMode === '14days' && (
                        <div>{date.toLocaleDateString('en-IN', { month: 'short' })}</div>
                      )}
                      {/* Occupancy indicator */}
                      <div className={`text-[10px] font-bold ${
                        isToday(date) ? 'text-white' : getOccupancyColor(occupancyData[index]?.percentage || 0)
                      }`}>
                        {occupancyData[index]?.percentage || 0}%
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {roomTypeGroups.map((group) => (
                  <>
                    {/* Room Type Group Header */}
                    <tr key={`group-${group.id}`} className="bg-gray-100">
                      <td 
                        colSpan={DAYS_TO_SHOW + 1}
                        className="sticky left-0 z-10"
                      >
                        <button
                          onClick={() => toggleRoomTypeGroup(group.id)}
                          className="w-full flex items-center gap-2 px-4 py-2 text-left font-semibold text-gray-700 hover:bg-gray-200 transition"
                        >
                          {group.isExpanded ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronUp className="w-4 h-4" />
                          )}
                          {group.name} ({group.rooms.length} rooms)
                        </button>
                      </td>
                    </tr>
                    {/* Room Rows */}
                    {group.isExpanded && group.rooms.map((room, roomIndex) => (
                      <tr key={room.id} className={roomIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        {/* Room Info */}
                        <td className="sticky left-0 z-10 bg-inherit px-4 py-2 border-r border-gray-200">
                          <div className="text-base font-bold text-gray-800">{room.room_number}</div>
                          <div className="text-xs text-gray-500">Floor {room.floor}</div>
                        </td>
                        {/* Date Cells */}
                        {dateRange.map((date, dateIndex) => {
                          const booking = getBookingForCell(room.id, date);
                          const reservation = !booking ? getReservationForCell(room.id, room.room_types.id, date) : null;
                          
                          const showBooking = booking && isBookingStart(booking, date);
                          const showReservation = reservation && isReservationStart(reservation, date);
                          
                          const bookingSpan = booking && showBooking ? getBookingSpan(booking, date) : 1;
                          const reservationSpan = reservation && showReservation ? getReservationSpan(reservation, date) : 1;
                          
                          const isInBooking = booking && !showBooking;
                          const isInReservation = reservation && !showReservation;
                          
                          if (isInBooking || isInReservation) {
                            return null; // Cell is part of a span
                          }
                          
                          return (
                            <td
                              key={dateIndex}
                              colSpan={showBooking ? bookingSpan : showReservation ? reservationSpan : 1}
                              className={`px-0.5 py-1 border border-gray-200 relative ${
                                isToday(date) ? 'bg-blue-50' : ''
                              }`}
                            >
                              {showBooking && booking ? (
                                <button
                                  onClick={() => setSelectedBooking(booking)}
                                  className={`w-full text-white text-xs px-1 py-1.5 rounded ${getBookingColor(booking)} transition truncate text-left`}
                                >
                                  <div className="font-medium truncate">{booking.guests.full_name}</div>
                                  {bookingSpan > 1 && (
                                    <div className="opacity-80 truncate text-[10px]">
                                      {booking.status === 'checked_in' ? '✓ In' : 'Res'}
                                    </div>
                                  )}
                                </button>
                              ) : showReservation && reservation ? (
                                <button
                                  onClick={() => setSelectedReservation(reservation)}
                                  className={`w-full text-white text-xs px-1 py-1.5 rounded ${getReservationColor()} transition truncate text-left`}
                                >
                                  <div className="font-medium truncate">{reservation.guests.full_name}</div>
                                  {reservationSpan > 1 && (
                                    <div className="opacity-80 truncate text-[10px]">📅 Res</div>
                                  )}
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleEmptyCellClick(room, date)}
                                  className="w-full h-8 rounded border border-dashed border-gray-300 hover:border-blue-400 hover:bg-blue-50 transition group"
                                >
                                  <Plus className="w-3 h-3 text-gray-300 group-hover:text-blue-500 mx-auto" />
                                </button>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600">Total Rooms</div>
            <div className="text-2xl font-bold text-gray-800">{rooms.length}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600">Currently Occupied</div>
            <div className="text-2xl font-bold text-emerald-600">
              {bookings.filter(b => b.status === 'checked_in').length}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600">Upcoming Reservations</div>
            <div className="text-2xl font-bold text-amber-600">
              {reservations.filter(r => r.status === 'confirmed').length}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600">Today's Occupancy</div>
            <div className={`text-2xl font-bold ${getOccupancyColor(occupancyData[0]?.percentage || 0)}`}>
              {occupancyData[0]?.percentage || 0}%
            </div>
          </div>
        </div>
      </div>

      {/* Date Picker Modal */}
      {showDatePicker && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-800">Go to Date</h3>
              <button
                onClick={() => setShowDatePicker(false)}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <input
              type="date"
              defaultValue={startDate.toISOString().split('T')[0]}
              onChange={(e) => goToDate(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-lg"
            />
          </div>
        </div>
      )}

      {/* Booking Detail Modal */}
      {selectedBooking && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-800">Booking Details</h3>
              <button
                onClick={() => setSelectedBooking(null)}
                className="p-2 hover:bg-gray-100 rounded-full transition"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <User className="w-5 h-5 text-gray-500" />
                <div>
                  <div className="font-medium text-gray-800">{selectedBooking.guests.full_name}</div>
                  <div className="text-sm text-gray-500">Guest Name</div>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <Phone className="w-5 h-5 text-gray-500" />
                <div>
                  <div className="font-medium text-gray-800">{selectedBooking.guests.mobile}</div>
                  <div className="text-sm text-gray-500">Mobile</div>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <Clock className="w-5 h-5 text-gray-500" />
                <div>
                  <div className="font-medium text-gray-800">
                    {new Date(selectedBooking.check_in_date).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric'
                    })} → {new Date(selectedBooking.expected_check_out_date).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric'
                    })}
                  </div>
                  <div className="text-sm text-gray-500">Stay Dates</div>
                </div>
              </div>

              <div className="pt-4 border-t">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-600">Room</span>
                  <span className="font-medium">{selectedBooking.rooms.room_number}</span>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-600">Guests</span>
                  <span className="font-medium">{selectedBooking.number_of_guests}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Status</span>
                  <span className={`px-2 py-1 rounded text-sm font-medium ${
                    selectedBooking.status === 'checked_in'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {selectedBooking.status === 'checked_in' ? 'In-House' : selectedBooking.status}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reservation Detail Modal */}
      {selectedReservation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-800">Reservation Details</h3>
              <button
                onClick={() => setSelectedReservation(null)}
                className="p-2 hover:bg-gray-100 rounded-full transition"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-lg">
                <User className="w-5 h-5 text-amber-600" />
                <div>
                  <div className="font-medium text-gray-800">{selectedReservation.guests.full_name}</div>
                  <div className="text-sm text-gray-500">Guest Name</div>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <Phone className="w-5 h-5 text-gray-500" />
                <div>
                  <div className="font-medium text-gray-800">{selectedReservation.guests.mobile}</div>
                  <div className="text-sm text-gray-500">Mobile</div>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <Clock className="w-5 h-5 text-gray-500" />
                <div>
                  <div className="font-medium text-gray-800">
                    {new Date(selectedReservation.check_in_date).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric'
                    })} → {new Date(selectedReservation.check_out_date).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric'
                    })}
                  </div>
                  <div className="text-sm text-gray-500">Reservation Dates</div>
                </div>
              </div>

              <div className="pt-4 border-t">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-600">Room Type</span>
                  <span className="font-medium">{selectedReservation.room_types.name}</span>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-600">Guests</span>
                  <span className="font-medium">{selectedReservation.number_of_guests}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Status</span>
                  <span className="px-2 py-1 rounded text-sm font-medium bg-amber-100 text-amber-800">
                    Confirmed
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Reservation Modal */}
      {showNewReservationModal && newReservationData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xl font-bold text-gray-800">Quick Reservation</h3>
                <p className="text-sm text-gray-600">
                  Room {newReservationData.roomNumber} • {newReservationData.roomTypeName}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowNewReservationModal(false);
                  setNewReservationData(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleCreateReservation} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Check-in Date</label>
                <input
                  type="text"
                  value={newReservationData.date.toLocaleDateString('en-IN', { 
                    weekday: 'short', 
                    day: '2-digit', 
                    month: 'short', 
                    year: 'numeric' 
                  })}
                  disabled
                  className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Number of Nights</label>
                <input
                  type="number"
                  name="nights"
                  defaultValue={1}
                  min={1}
                  max={30}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Guest Name</label>
                <input
                  type="text"
                  name="guest_name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mobile Number</label>
                <input
                  type="tel"
                  name="guest_mobile"
                  pattern="[0-9]{10}"
                  placeholder="10-digit mobile"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowNewReservationModal(false);
                    setNewReservationData(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Create Reservation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
