import { useState, useEffect, useCallback } from 'react';
import { Plus, Edit2, Trash2, Clock, RefreshCw } from 'lucide-react';
import Layout from '../components/Layout';
import { supabase } from '../lib/supabase';

interface RoomType {
  id: string;
  name: string;
  base_rate: number;
  max_occupancy: number;
  description: string;
}

interface Room {
  id: string;
  room_number: string;
  room_type_id: string;
  floor: number;
  status: string;
}

interface LoginLog {
  id: string;
  user_email: string;
  user_name: string | null;
  login_time: string;
  user_agent: string | null;
}

export default function Settings() {
  const [activeTab, setActiveTab] = useState<'room-types' | 'rooms' | 'taxes' | 'audit-logs'>('room-types');
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [showRoomTypeModal, setShowRoomTypeModal] = useState(false);
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [editingRoomType, setEditingRoomType] = useState<RoomType | null>(null);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [loginLogs, setLoginLogs] = useState<LoginLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  useEffect(() => {
    loadRoomTypes();
    loadRooms();
  }, []);

  const loadLoginLogs = useCallback(async () => {
    setLoadingLogs(true);
    try {
      const { data } = await supabase
        .from('login_logs')
        .select('*')
        .order('login_time', { ascending: false })
        .limit(100);
      setLoginLogs(data || []);
    } catch (error) {
      console.error('Error loading login logs:', error);
    } finally {
      setLoadingLogs(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'audit-logs') {
      loadLoginLogs();
    }
  }, [activeTab, loadLoginLogs]);

  const loadRoomTypes = async () => {
    const { data } = await supabase
      .from('room_types')
      .select('*')
      .order('name');
    setRoomTypes(data || []);
  };

  const loadRooms = async () => {
    const { data } = await supabase
      .from('rooms')
      .select('*')
      .order('room_number');
    setRooms(data || []);
  };

  const handleSaveRoomType = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get('name') as string,
      base_rate: parseFloat(formData.get('base_rate') as string),
      max_occupancy: parseInt(formData.get('max_occupancy') as string),
      description: formData.get('description') as string,
    };

    if (editingRoomType) {
      await supabase
        .from('room_types')
        .update(data)
        .eq('id', editingRoomType.id);
    } else {
      await supabase.from('room_types').insert([data]);
    }

    loadRoomTypes();
    setShowRoomTypeModal(false);
    setEditingRoomType(null);
  };

  const handleSaveRoom = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      room_number: formData.get('room_number') as string,
      room_type_id: formData.get('room_type_id') as string,
      floor: parseInt(formData.get('floor') as string),
      status: formData.get('status') as string,
    };

    if (editingRoom) {
      await supabase
        .from('rooms')
        .update(data)
        .eq('id', editingRoom.id);
    } else {
      await supabase.from('rooms').insert([data]);
    }

    loadRooms();
    setShowRoomModal(false);
    setEditingRoom(null);
  };

  const handleDeleteRoomType = async (id: string) => {
    if (confirm('Are you sure you want to delete this room type?')) {
      await supabase.from('room_types').delete().eq('id', id);
      loadRoomTypes();
    }
  };

  const handleDeleteRoom = async (id: string) => {
    if (confirm('Are you sure you want to delete this room?')) {
      await supabase.from('rooms').delete().eq('id', id);
      loadRooms();
    }
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Settings</h1>
          <p className="text-gray-600">Manage room types, rooms, and system configuration</p>
        </div>

        <div className="bg-white rounded-lg shadow mb-6">
          <div className="border-b">
            <nav className="flex space-x-8 px-6">
              <button
                onClick={() => setActiveTab('room-types')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'room-types'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-800'
                }`}
              >
                Room Types
              </button>
              <button
                onClick={() => setActiveTab('rooms')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'rooms'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-800'
                }`}
              >
                Rooms
              </button>
              <button
                onClick={() => setActiveTab('taxes')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'taxes'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-800'
                }`}
              >
                Tax Configuration
              </button>
              <button
                onClick={() => setActiveTab('audit-logs')}
                className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-1 ${
                  activeTab === 'audit-logs'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-800'
                }`}
              >
                <Clock className="w-4 h-4" />
                Audit Logs
              </button>
            </nav>
          </div>

          <div className="p-6">
            {activeTab === 'room-types' && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-semibold text-gray-800">Room Types</h2>
                  <button
                    onClick={() => {
                      setEditingRoomType(null);
                      setShowRoomTypeModal(true);
                    }}
                    className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Room Type
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Base Rate</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Max Occupancy</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {roomTypes.map((type) => (
                        <tr key={type.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-800">{type.name}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">₹{type.base_rate}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{type.max_occupancy}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">{type.description}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                            <button
                              onClick={() => {
                                setEditingRoomType(type);
                                setShowRoomTypeModal(true);
                              }}
                              className="text-blue-600 hover:text-blue-800 mr-3"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteRoomType(type.id)}
                              className="text-red-600 hover:text-red-800"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'rooms' && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-semibold text-gray-800">Rooms</h2>
                  <button
                    onClick={() => {
                      setEditingRoom(null);
                      setShowRoomModal(true);
                    }}
                    className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Room
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Room Number</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Floor</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {rooms.map((room) => (
                        <tr key={room.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-800">{room.room_number}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{room.floor}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 capitalize">{room.status.replace(/_/g, ' ')}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                            <button
                              onClick={() => {
                                setEditingRoom(room);
                                setShowRoomModal(true);
                              }}
                              className="text-blue-600 hover:text-blue-800 mr-3"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteRoom(room.id)}
                              className="text-red-600 hover:text-red-800"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'taxes' && (
              <div>
                <h2 className="text-xl font-semibold text-gray-800 mb-4">Tax Configuration</h2>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <p className="text-sm text-blue-800">
                    Default GST rates are configured at 6% CGST and 6% SGST (total 12%).
                  </p>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-800">CGST</p>
                      <p className="text-sm text-gray-600">Central Goods and Services Tax</p>
                    </div>
                    <p className="text-2xl font-bold text-gray-800">6%</p>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-800">SGST</p>
                      <p className="text-sm text-gray-600">State Goods and Services Tax</p>
                    </div>
                    <p className="text-2xl font-bold text-gray-800">6%</p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'audit-logs' && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-800">Login Audit Logs</h2>
                    <p className="text-sm text-gray-600">Track all PMS login activity for accountability</p>
                  </div>
                  <button
                    onClick={loadLoginLogs}
                    disabled={loadingLogs}
                    className="flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition disabled:opacity-50"
                  >
                    <RefreshCw className={`w-4 h-4 mr-2 ${loadingLogs ? 'animate-spin' : ''}`} />
                    Refresh
                  </button>
                </div>

                {loadingLogs ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                ) : loginLogs.length === 0 ? (
                  <div className="text-center py-12 bg-gray-50 rounded-lg">
                    <Clock className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-600">No login records found</p>
                    <p className="text-sm text-gray-500">Login activity will appear here after users sign in</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Login Time</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Browser</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {loginLogs.map((log) => (
                          <tr key={log.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-800">
                              {log.user_name || 'Unknown'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                              {log.user_email}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                              {new Date(log.login_time).toLocaleString('en-IN', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                                hour12: true,
                              })}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                              {log.user_agent ? (
                                log.user_agent.includes('Chrome') ? 'Chrome' :
                                log.user_agent.includes('Firefox') ? 'Firefox' :
                                log.user_agent.includes('Safari') ? 'Safari' :
                                log.user_agent.includes('Edge') ? 'Edge' : 'Other'
                              ) : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {showRoomTypeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4">
              {editingRoomType ? 'Edit Room Type' : 'Add Room Type'}
            </h3>
            <form onSubmit={handleSaveRoomType}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input
                    type="text"
                    name="name"
                    defaultValue={editingRoomType?.name}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Base Rate (₹)</label>
                  <input
                    type="number"
                    name="base_rate"
                    defaultValue={editingRoomType?.base_rate}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Max Occupancy</label>
                  <input
                    type="number"
                    name="max_occupancy"
                    defaultValue={editingRoomType?.max_occupancy || 2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    name="description"
                    defaultValue={editingRoomType?.description}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={3}
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowRoomTypeModal(false);
                    setEditingRoomType(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showRoomModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4">
              {editingRoom ? 'Edit Room' : 'Add Room'}
            </h3>
            <form onSubmit={handleSaveRoom}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Room Number</label>
                  <input
                    type="text"
                    name="room_number"
                    defaultValue={editingRoom?.room_number}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Room Type</label>
                  <select
                    name="room_type_id"
                    defaultValue={editingRoom?.room_type_id}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="">Select Room Type</option>
                    {roomTypes.map((type) => (
                      <option key={type.id} value={type.id}>{type.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Floor</label>
                  <input
                    type="number"
                    name="floor"
                    defaultValue={editingRoom?.floor}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    name="status"
                    defaultValue={editingRoom?.status || 'vacant_clean'}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="vacant_clean">Vacant Clean</option>
                    <option value="vacant_dirty">Vacant Dirty</option>
                    <option value="occupied">Occupied</option>
                    <option value="out_of_order">Out of Order</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowRoomModal(false);
                    setEditingRoom(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
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
