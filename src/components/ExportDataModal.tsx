import { useState } from 'react';
import { X, FileJson, FileSpreadsheet, Loader2 } from 'lucide-react';
import { 
  exportGuestDataJSON, 
  downloadJSON, 
  convertToCSV, 
  downloadCSV 
} from '../lib/documentArchiveService';

interface ExportDataModalProps {
  guestId: string;
  guestName: string;
  onClose: () => void;
}

export default function ExportDataModal({ guestId, guestName, onClose }: ExportDataModalProps) {
  const [exporting, setExporting] = useState(false);
  const [exportType, setExportType] = useState<'json' | 'csv' | null>(null);

  const handleExportJSON = async () => {
    setExporting(true);
    setExportType('json');
    
    try {
      const data = await exportGuestDataJSON(guestId);
      const filename = `guest_${guestName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.json`;
      downloadJSON(data, filename);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export data. Please try again.');
    } finally {
      setExporting(false);
      setExportType(null);
    }
  };

  const handleExportCSV = async () => {
    setExporting(true);
    setExportType('csv');
    
    try {
      const data = await exportGuestDataJSON(guestId);
      
      // Convert guest info to CSV
      const guestCSV = convertToCSV([{
        id: data.guest?.id,
        full_name: data.guest?.full_name,
        mobile: data.guest?.mobile,
        email: data.guest?.email || '',
        address: data.guest?.address || '',
        id_proof_type: data.guest?.id_proof_type || '',
        id_proof_number: data.guest?.id_proof_number || '',
      }]);

      // Convert stay history to CSV
      const stayRows = data.stay_history?.map((stay: { 
        id: string; 
        check_in_date: string; 
        expected_check_out_date: string; 
        actual_check_out_date?: string; 
        status: string;
        rooms?: { room_number: string; room_types?: { name: string } };
        charges?: { amount: number }[];
        payments?: { amount: number }[];
      }) => ({
        booking_id: stay.id,
        check_in: stay.check_in_date,
        expected_checkout: stay.expected_check_out_date,
        actual_checkout: stay.actual_check_out_date || '',
        status: stay.status,
        room_number: stay.rooms?.room_number || '',
        room_type: stay.rooms?.room_types?.name || '',
        total_charges: stay.charges?.reduce((s: number, c: { amount: number }) => s + c.amount, 0) || 0,
        total_payments: stay.payments?.reduce((s: number, p: { amount: number }) => s + p.amount, 0) || 0,
      })) || [];
      const stayCSV = convertToCSV(stayRows);

      // Combine into single file with sections
      const combinedCSV = `GUEST INFORMATION\n${guestCSV}\n\nSTAY HISTORY\n${stayCSV}`;
      
      const filename = `guest_${guestName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
      downloadCSV(combinedCSV, filename);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export data. Please try again.');
    } finally {
      setExporting(false);
      setExportType(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-bold text-gray-800">Export Guest Data</h3>
            <p className="text-sm text-gray-600">{guestName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="space-y-4 mb-6">
          <p className="text-sm text-gray-600">
            Export complete guest records including profile, stay history, charges, payments, and archived documents for offline backup.
          </p>

          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="font-medium text-blue-800 mb-2">Export includes:</h4>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• Guest profile & ID details</li>
              <li>• Complete stay history</li>
              <li>• All charges & payments</li>
              <li>• Archived Invoice & GRC data</li>
            </ul>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleExportJSON}
            disabled={exporting}
            className="flex items-center justify-center px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:opacity-50"
          >
            {exporting && exportType === 'json' ? (
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            ) : (
              <FileJson className="w-5 h-5 mr-2" />
            )}
            Export JSON
          </button>
          <button
            onClick={handleExportCSV}
            disabled={exporting}
            className="flex items-center justify-center px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50"
          >
            {exporting && exportType === 'csv' ? (
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            ) : (
              <FileSpreadsheet className="w-5 h-5 mr-2" />
            )}
            Export CSV
          </button>
        </div>

        <p className="text-xs text-gray-500 text-center mt-4">
          Files will be downloaded to your device for offline storage
        </p>
      </div>
    </div>
  );
}
