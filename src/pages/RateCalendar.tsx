import { useState, useEffect, useCallback } from 'react';
import { Calendar, Plus, Edit2, Trash2, X, Check, IndianRupee } from 'lucide-react';
import Layout from '../components/Layout';
import { supabase } from '../lib/supabase';

interface RoomType {
  id: string;
  name: string;
  base_rate: number;
}

interface SeasonalRate {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  multiplier: number;
  is_active: boolean;
}

interface DayOfWeekRate {
  day: number; // 0 = Sunday, 6 = Saturday
  name: string;
  multiplier: number;
}

const defaultDayRates: DayOfWeekRate[] = [
  { day: 0, name: 'Sunday', multiplier: 1.0 },
  { day: 1, name: 'Monday', multiplier: 1.0 },
  { day: 2, name: 'Tuesday', multiplier: 1.0 },
  { day: 3, name: 'Wednesday', multiplier: 1.0 },
  { day: 4, name: 'Thursday', multiplier: 1.0 },
  { day: 5, name: 'Friday', multiplier: 1.2 },
  { day: 6, name: 'Saturday', multiplier: 1.3 },
];

export default function RateCalendar() {
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [seasonalRates, setSeasonalRates] = useState<SeasonalRate[]>([]);
  const [dayRates, setDayRates] = useState<DayOfWeekRate[]>(defaultDayRates);
  const [loading, setLoading] = useState(true);
  const [showSeasonModal, setShowSeasonModal] = useState(false);
  const [editingSeason, setEditingSeason] = useState<SeasonalRate | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  
  // Form state
  const [seasonForm, setSeasonForm] = useState({
    name: '',
    start_date: '',
    end_date: '',
    multiplier: 1.0,
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Load room types
      const { data: typesData } = await supabase
        .from('room_types')
        .select('*')
        .order('name');

      setRoomTypes(typesData || []);

      // Load seasonal rates from local storage (or could be a DB table)
      const savedSeasons = localStorage.getItem('sharda_seasonal_rates');
      if (savedSeasons) {
        setSeasonalRates(JSON.parse(savedSeasons));
      }

      const savedDayRates = localStorage.getItem('sharda_day_rates');
      if (savedDayRates) {
        setDayRates(JSON.parse(savedDayRates));
      }
    } catch (error) {
      console.error('Error loading rate data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const saveSeasonalRates = (rates: SeasonalRate[]) => {
    localStorage.setItem('sharda_seasonal_rates', JSON.stringify(rates));
    setSeasonalRates(rates);
  };

  const saveDayRates = (rates: DayOfWeekRate[]) => {
    localStorage.setItem('sharda_day_rates', JSON.stringify(rates));
    setDayRates(rates);
  };

  const handleAddSeason = () => {
    setEditingSeason(null);
    setSeasonForm({
      name: '',
      start_date: '',
      end_date: '',
      multiplier: 1.0,
    });
    setShowSeasonModal(true);
  };

  const handleEditSeason = (season: SeasonalRate) => {
    setEditingSeason(season);
    setSeasonForm({
      name: season.name,
      start_date: season.start_date,
      end_date: season.end_date,
      multiplier: season.multiplier,
    });
    setShowSeasonModal(true);
  };

  const handleSaveSeason = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingSeason) {
      // Update existing
      const updated = seasonalRates.map(s => 
        s.id === editingSeason.id 
          ? { ...s, ...seasonForm }
          : s
      );
      saveSeasonalRates(updated);
    } else {
      // Add new
      const newSeason: SeasonalRate = {
        id: Date.now().toString(),
        ...seasonForm,
        is_active: true,
      };
      saveSeasonalRates([...seasonalRates, newSeason]);
    }
    
    setShowSeasonModal(false);
  };

  const handleDeleteSeason = (id: string) => {
    if (confirm('Delete this seasonal rate?')) {
      saveSeasonalRates(seasonalRates.filter(s => s.id !== id));
    }
  };

  const handleDayRateChange = (day: number, multiplier: number) => {
    const updated = dayRates.map(d => 
      d.day === day ? { ...d, multiplier } : d
    );
    saveDayRates(updated);
  };

  // Calculate effective rate for a date
  const getEffectiveRate = (baseRate: number, date: Date): number => {
    let rate = baseRate;
    
    // Apply day of week multiplier
    const dayRate = dayRates.find(d => d.day === date.getDay());
    if (dayRate) {
      rate *= dayRate.multiplier;
    }
    
    // Apply seasonal multiplier
    const dateStr = date.toISOString().split('T')[0];
    const activeSeason = seasonalRates.find(s => 
      s.is_active && dateStr >= s.start_date && dateStr <= s.end_date
    );
    if (activeSeason) {
      rate *= activeSeason.multiplier;
    }
    
    return Math.round(rate);
  };

  // Generate calendar days for the selected month
  const generateCalendarDays = () => {
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    const days: (Date | null)[] = [];
    
    // Add empty cells for days before first of month
    for (let i = 0; i < firstDay.getDay(); i++) {
      days.push(null);
    }
    
    // Add all days of month
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(year, month, i));
    }
    
    return days;
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(selectedDate);
    newDate.setMonth(selectedDate.getMonth() + (direction === 'next' ? 1 : -1));
    setSelectedDate(newDate);
  };

  const isSeasonalDate = (date: Date): SeasonalRate | undefined => {
    const dateStr = date.toISOString().split('T')[0];
    return seasonalRates.find(s => 
      s.is_active && dateStr >= s.start_date && dateStr <= s.end_date
    );
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Loading rate calendar...</p>
          </div>
        </div>
      </Layout>
    );
  }

  const calendarDays = generateCalendarDays();

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <Calendar className="w-8 h-8 text-emerald-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-800">Rate Calendar</h1>
              <p className="text-gray-600">Manage seasonal and day-of-week pricing</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Day of Week Rates */}
          <div className="lg:col-span-1 space-y-6">
            {/* Day of Week Rates */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Day of Week Rates</h3>
              <p className="text-sm text-gray-600 mb-4">Multiplier applied to base rate</p>
              <div className="space-y-3">
                {dayRates.map((day) => (
                  <div key={day.day} className="flex items-center justify-between">
                    <span className={`text-gray-700 ${day.day === 0 || day.day === 6 ? 'font-semibold' : ''}`}>
                      {day.name}
                    </span>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.1"
                        min="0.5"
                        max="3"
                        value={day.multiplier}
                        onChange={(e) => handleDayRateChange(day.day, parseFloat(e.target.value) || 1)}
                        className="w-20 px-2 py-1 border rounded text-center text-sm"
                      />
                      <span className="text-xs text-gray-500">×</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Seasonal Rates */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800">Seasonal Rates</h3>
                <button
                  onClick={handleAddSeason}
                  className="p-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              
              {seasonalRates.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">
                  No seasonal rates configured
                </p>
              ) : (
                <div className="space-y-3">
                  {seasonalRates.map((season) => (
                    <div 
                      key={season.id}
                      className="p-3 border rounded-lg bg-gray-50"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-gray-800">{season.name}</span>
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleEditSeason(season)}
                            className="p-1 hover:bg-gray-200 rounded"
                          >
                            <Edit2 className="w-4 h-4 text-gray-500" />
                          </button>
                          <button
                            onClick={() => handleDeleteSeason(season.id)}
                            className="p-1 hover:bg-red-100 rounded"
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </button>
                        </div>
                      </div>
                      <div className="text-xs text-gray-600">
                        {new Date(season.start_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} - {new Date(season.end_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                      </div>
                      <div className="text-sm font-medium text-emerald-600">
                        {season.multiplier}× multiplier
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Calendar View */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow">
              {/* Month Navigation */}
              <div className="p-4 border-b flex items-center justify-between">
                <button
                  onClick={() => navigateMonth('prev')}
                  className="px-3 py-1 bg-gray-100 rounded hover:bg-gray-200"
                >
                  ← Prev
                </button>
                <h3 className="text-lg font-semibold text-gray-800">
                  {selectedDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
                </h3>
                <button
                  onClick={() => navigateMonth('next')}
                  className="px-3 py-1 bg-gray-100 rounded hover:bg-gray-200"
                >
                  Next →
                </button>
              </div>

              {/* Room Type Selector for Preview */}
              <div className="p-4 border-b bg-gray-50">
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-600">Preview rates for:</span>
                  <select className="px-3 py-1 border rounded text-sm">
                    {roomTypes.map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.name} (Base: ₹{type.base_rate})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Calendar Grid */}
              <div className="p-4">
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                    <div key={day} className="text-center text-xs font-medium text-gray-500 py-2">
                      {day}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {calendarDays.map((date, index) => {
                    if (!date) {
                      return <div key={`empty-${index}`} className="p-2"></div>;
                    }
                    
                    const season = isSeasonalDate(date);
                    const baseRate = roomTypes[0]?.base_rate || 1000;
                    const effectiveRate = getEffectiveRate(baseRate, date);
                    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                    const isToday = date.toISOString().split('T')[0] === new Date().toISOString().split('T')[0];
                    
                    return (
                      <div
                        key={date.toISOString()}
                        className={`p-2 border rounded text-center min-h-[70px] ${
                          season 
                            ? 'bg-emerald-50 border-emerald-200' 
                            : isWeekend 
                            ? 'bg-blue-50 border-blue-200' 
                            : 'bg-white'
                        } ${isToday ? 'ring-2 ring-blue-500' : ''}`}
                      >
                        <div className={`text-sm font-medium ${isToday ? 'text-blue-600' : 'text-gray-700'}`}>
                          {date.getDate()}
                        </div>
                        <div className="text-xs text-gray-600 mt-1 flex items-center justify-center">
                          <IndianRupee className="w-3 h-3" />
                          {effectiveRate}
                        </div>
                        {season && (
                          <div className="text-[10px] text-emerald-600 truncate mt-1">
                            {season.name}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Legend */}
              <div className="p-4 border-t bg-gray-50">
                <div className="flex flex-wrap gap-4 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-white border"></div>
                    <span>Weekday</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-blue-50 border border-blue-200"></div>
                    <span>Weekend</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-emerald-50 border border-emerald-200"></div>
                    <span>Seasonal</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Season Modal */}
      {showSeasonModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-800">
                {editingSeason ? 'Edit Season' : 'Add Season'}
              </h3>
              <button
                onClick={() => setShowSeasonModal(false)}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleSaveSeason} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Season Name
                </label>
                <input
                  type="text"
                  value={seasonForm.name}
                  onChange={(e) => setSeasonForm({ ...seasonForm, name: e.target.value })}
                  placeholder="e.g., Diwali Festival, Summer Peak"
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={seasonForm.start_date}
                    onChange={(e) => setSeasonForm({ ...seasonForm, start_date: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={seasonForm.end_date}
                    onChange={(e) => setSeasonForm({ ...seasonForm, end_date: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rate Multiplier
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0.5"
                  max="5"
                  value={seasonForm.multiplier}
                  onChange={(e) => setSeasonForm({ ...seasonForm, multiplier: parseFloat(e.target.value) || 1 })}
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  1.0 = normal rate, 1.5 = 50% increase, 0.8 = 20% discount
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowSeasonModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center justify-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
