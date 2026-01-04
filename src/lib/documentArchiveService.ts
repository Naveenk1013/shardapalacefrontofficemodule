import { supabase } from './supabase';
import { hotelConfig } from './hotelConfig';

// Types for document archival
interface BookingData {
  id: string;
  check_in_date: string;
  expected_check_out_date: string;
  actual_check_out_date?: string;
  number_of_guests: number;
  advance_payment: number;
  guests: {
    id: string;
    full_name: string;
    mobile: string;
    email?: string;
    address?: string;
    id_proof_type?: string;
    id_proof_number?: string;
  };
  rooms: {
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

interface TaxConfig {
  cgst: number;
  sgst: number;
}

interface DocumentData {
  guest: {
    id: string;
    full_name: string;
    mobile: string;
    email?: string;
    address?: string;
    id_proof_type?: string;
    id_proof_number?: string;
  };
  room: {
    room_number: string;
    room_type: string;
    base_rate: number;
  };
  stay: {
    check_in_date: string;
    check_out_date: string;
    number_of_guests: number;
  };
  charges: FolioCharge[];
  payments: Payment[];
  taxes: TaxConfig;
  totals: {
    subtotal: number;
    cgst_amount: number;
    sgst_amount: number;
    grand_total: number;
    total_paid: number;
    balance: number;
  };
  hotel: {
    name: string;
    address: string;
    phone: string;
    email: string;
    gstin: string;
  };
  document_date: string;
}

/**
 * Generate Invoice HTML for archival
 */
function generateInvoiceHTML(
  documentNumber: string,
  data: DocumentData
): string {
  const { guest, room, stay, charges, payments, taxes, totals, hotel, document_date } = data;

  const chargeRows = charges
    .map(
      (charge) => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-size: 14px;">${new Date(charge.charge_date).toLocaleDateString('en-IN')}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-size: 14px;">${charge.description}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-size: 14px; text-align: right;">₹${charge.amount.toFixed(2)}</td>
      </tr>
    `
    )
    .join('');

  const paymentRows = payments
    .map(
      (payment) => `
      <div style="display: flex; justify-content: space-between; padding: 4px 0;">
        <span>${new Date(payment.payment_date).toLocaleDateString('en-IN')} - ${payment.payment_mode.toUpperCase()}</span>
        <span>₹${payment.amount.toFixed(2)}</span>
      </div>
    `
    )
    .join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Invoice ${documentNumber}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 0; padding: 20px; color: #333; }
    .container { max-width: 800px; margin: 0 auto; }
    .header { border-bottom: 2px solid #1f2937; padding-bottom: 16px; margin-bottom: 24px; }
    .hotel-name { font-size: 28px; font-weight: bold; color: #111; }
    .invoice-title { font-size: 22px; font-weight: bold; color: #1d4ed8; }
    .section { background: #f9fafb; padding: 16px; border-radius: 8px; margin-bottom: 16px; }
    .section-title { font-weight: 600; font-size: 14px; color: #374151; margin-bottom: 8px; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #1f2937; color: white; padding: 10px 8px; text-align: left; font-size: 13px; }
    .totals { width: 300px; margin-left: auto; }
    .total-row { display: flex; justify-content: space-between; padding: 6px 0; }
    .grand-total { font-size: 18px; font-weight: bold; border-top: 2px solid #1f2937; padding-top: 8px; margin-top: 8px; }
    .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 14px; }
    .archived-stamp { position: absolute; top: 20px; right: 20px; background: #059669; color: white; padding: 4px 12px; font-size: 12px; border-radius: 4px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="archived-stamp">ARCHIVED COPY</div>
    
    <div class="header">
      <div style="display: flex; justify-content: space-between;">
        <div>
          <div class="hotel-name">${hotel.name}</div>
          <div style="color: #6b7280; margin-top: 4px;">${hotel.address}</div>
          <div style="color: #6b7280; font-size: 14px; margin-top: 8px;">📞 ${hotel.phone} | ✉️ ${hotel.email}</div>
          <div style="color: #6b7280; font-size: 14px;">GSTIN: ${hotel.gstin}</div>
        </div>
        <div style="text-align: right;">
          <div class="invoice-title">TAX INVOICE</div>
          <div style="margin-top: 8px;"><strong>Invoice No:</strong> ${documentNumber}</div>
          <div><strong>Date:</strong> ${document_date}</div>
        </div>
      </div>
    </div>

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px;">
      <div class="section">
        <div class="section-title">Bill To:</div>
        <div style="font-weight: 500;">${guest.full_name}</div>
        <div>📱 ${guest.mobile}</div>
        ${guest.address ? `<div style="font-size: 14px; margin-top: 4px;">${guest.address}</div>` : ''}
        ${guest.id_proof_type ? `<div style="font-size: 14px; margin-top: 4px;"><strong>ID:</strong> ${guest.id_proof_type.toUpperCase()} - ${guest.id_proof_number}</div>` : ''}
      </div>
      <div class="section">
        <div class="section-title">Stay Details:</div>
        <div><strong>Room:</strong> ${room.room_number} (${room.room_type})</div>
        <div><strong>Check-In:</strong> ${new Date(stay.check_in_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
        <div><strong>Check-Out:</strong> ${new Date(stay.check_out_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
        <div><strong>Guests:</strong> ${stay.number_of_guests}</div>
      </div>
    </div>

    <table style="margin-bottom: 24px;">
      <thead>
        <tr>
          <th>Date</th>
          <th>Description</th>
          <th style="text-align: right;">Amount (₹)</th>
        </tr>
      </thead>
      <tbody>
        ${chargeRows}
      </tbody>
    </table>

    <div class="totals">
      <div class="total-row"><span>Subtotal</span><span>₹${totals.subtotal.toFixed(2)}</span></div>
      <div class="total-row"><span>CGST (${taxes.cgst}%)</span><span>₹${totals.cgst_amount.toFixed(2)}</span></div>
      <div class="total-row"><span>SGST (${taxes.sgst}%)</span><span>₹${totals.sgst_amount.toFixed(2)}</span></div>
      <div class="total-row grand-total"><span>Grand Total</span><span>₹${totals.grand_total.toFixed(2)}</span></div>
      <div class="total-row" style="color: #059669;"><span>Amount Paid</span><span>₹${totals.total_paid.toFixed(2)}</span></div>
      ${totals.balance > 0 ? `<div class="total-row" style="color: #dc2626; font-weight: 600;"><span>Balance Due</span><span>₹${totals.balance.toFixed(2)}</span></div>` : `<div class="total-row" style="color: #059669; font-weight: 600;"><span>Status</span><span>PAID ✓</span></div>`}
    </div>

    ${payments.length > 0 ? `
    <div style="margin-top: 24px;">
      <div class="section-title">Payment History:</div>
      <div style="font-size: 14px; color: #6b7280;">
        ${paymentRows}
      </div>
    </div>
    ` : ''}

    <div class="footer">
      <p>Thank you for staying with us!</p>
      <p style="font-weight: 600;">${hotel.name}</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Generate GRC HTML for archival
 */
function generateGRCHTML(documentNumber: string, data: DocumentData): string {
  const { guest, room, stay, hotel, document_date } = data;

  const formatIdProofType = (type?: string) => {
    if (!type) return 'N/A';
    const types: Record<string, string> = {
      aadhaar: 'Aadhaar Card',
      passport: 'Passport',
      driving_license: 'Driving License',
      other: 'Other',
    };
    return types[type] || type;
  };

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>GRC ${documentNumber}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 0; padding: 20px; color: #333; }
    .container { max-width: 800px; margin: 0 auto; }
    .header { border-bottom: 2px solid #1f2937; padding-bottom: 16px; margin-bottom: 24px; text-align: center; }
    .hotel-name { font-size: 28px; font-weight: bold; color: #111; }
    .grc-title { font-size: 20px; font-weight: bold; color: #1d4ed8; text-transform: uppercase; letter-spacing: 1px; margin-top: 16px; }
    .section { border: 1px solid #d1d5db; padding: 16px; border-radius: 8px; margin-bottom: 16px; }
    .section-title { font-weight: bold; font-size: 15px; color: #1f2937; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 1px solid #e5e7eb; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .info-item label { font-size: 13px; color: #6b7280; display: block; margin-bottom: 2px; }
    .info-item span { font-weight: 500; }
    .declaration { background: #f9fafb; border: 1px solid #d1d5db; padding: 16px; border-radius: 8px; margin: 24px 0; font-size: 14px; }
    .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-top: 48px; }
    .signature-box { text-align: center; }
    .signature-line { border-top: 1px solid #9ca3af; padding-top: 8px; margin: 0 32px; }
    .footer { margin-top: 48px; padding-top: 16px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 14px; }
    .archived-stamp { position: absolute; top: 20px; right: 20px; background: #059669; color: white; padding: 4px 12px; font-size: 12px; border-radius: 4px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="archived-stamp">ARCHIVED COPY</div>
    
    <div class="header">
      <div class="hotel-name">${hotel.name}</div>
      <div style="color: #6b7280; margin-top: 4px;">${hotel.address}</div>
      <div style="color: #6b7280; font-size: 14px;">📞 ${hotel.phone} | ✉️ ${hotel.email}</div>
      <div class="grc-title">Guest Registration Card</div>
      <div style="color: #6b7280; font-size: 13px;">(Form C - As per Government Regulations)</div>
    </div>

    <div style="display: flex; justify-content: space-between; margin-bottom: 24px; color: #374151;">
      <div><strong>GRC No:</strong> ${documentNumber}</div>
      <div><strong>Date:</strong> ${document_date}</div>
    </div>

    <div class="section">
      <div class="section-title">Guest Information</div>
      <div class="info-grid">
        <div class="info-item">
          <label>Full Name</label>
          <span>${guest.full_name}</span>
        </div>
        <div class="info-item">
          <label>Mobile Number</label>
          <span>${guest.mobile}</span>
        </div>
        ${guest.email ? `
        <div class="info-item">
          <label>Email</label>
          <span>${guest.email}</span>
        </div>
        ` : ''}
        <div class="info-item">
          <label>Number of Guests</label>
          <span>${stay.number_of_guests}</span>
        </div>
        ${guest.address ? `
        <div class="info-item" style="grid-column: span 2;">
          <label>Address</label>
          <span>${guest.address}</span>
        </div>
        ` : ''}
      </div>
    </div>

    <div class="section">
      <div class="section-title">Identity Verification</div>
      <div class="info-grid">
        <div class="info-item">
          <label>ID Proof Type</label>
          <span>${formatIdProofType(guest.id_proof_type)}</span>
        </div>
        <div class="info-item">
          <label>ID Proof Number</label>
          <span>${guest.id_proof_number || 'N/A'}</span>
        </div>
        <div class="info-item">
          <label>Nationality</label>
          <span>Indian</span>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Accommodation Details</div>
      <div class="info-grid">
        <div class="info-item">
          <label>Room Number</label>
          <span style="font-size: 18px;">${room.room_number}</span>
        </div>
        <div class="info-item">
          <label>Room Type</label>
          <span>${room.room_type}</span>
        </div>
        <div class="info-item">
          <label>Check-In Date & Time</label>
          <span>${new Date(stay.check_in_date).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
        </div>
        <div class="info-item">
          <label>Expected Check-Out Date</label>
          <span>${new Date(stay.check_out_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
        </div>
      </div>
    </div>

    <div class="declaration">
      I hereby declare that the information provided above is true and correct to the best of my knowledge.
      I agree to abide by the hotel rules and regulations during my stay.
    </div>

    <div class="signatures">
      <div class="signature-box">
        <div class="signature-line">
          <div style="font-size: 13px; color: #6b7280;">Guest Signature</div>
          <div style="font-weight: 500; margin-top: 4px;">${guest.full_name}</div>
        </div>
      </div>
      <div class="signature-box">
        <div class="signature-line">
          <div style="font-size: 13px; color: #6b7280;">Front Desk Signature</div>
          <div style="font-weight: 500; margin-top: 4px;">Authorized Signatory</div>
        </div>
      </div>
    </div>

    <div class="footer">
      <p>Thank you for choosing ${hotel.name}</p>
      <p style="font-size: 12px;">This is a computer-generated document</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Archive Invoice document on checkout
 */
export async function archiveInvoice(
  booking: BookingData,
  folioCharges: FolioCharge[],
  payments: Payment[],
  taxes: TaxConfig
): Promise<{ success: boolean; documentNumber?: string; error?: string }> {
  try {
    const documentNumber = `${hotelConfig.invoice.prefix}-${booking.id.slice(0, 8).toUpperCase()}`;
    const documentDate = new Date().toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

    const subtotal = folioCharges.reduce((sum, c) => sum + Number(c.amount), 0);
    const cgstAmount = (subtotal * taxes.cgst) / 100;
    const sgstAmount = (subtotal * taxes.sgst) / 100;
    const grandTotal = subtotal + cgstAmount + sgstAmount;
    const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
    const balance = grandTotal - totalPaid;

    const documentData: DocumentData = {
      guest: {
        id: booking.guests.id,
        full_name: booking.guests.full_name,
        mobile: booking.guests.mobile,
        email: booking.guests.email,
        address: booking.guests.address,
        id_proof_type: booking.guests.id_proof_type,
        id_proof_number: booking.guests.id_proof_number,
      },
      room: {
        room_number: booking.rooms.room_number,
        room_type: booking.rooms.room_types.name,
        base_rate: booking.rooms.room_types.base_rate,
      },
      stay: {
        check_in_date: booking.check_in_date,
        check_out_date: booking.actual_check_out_date || booking.expected_check_out_date,
        number_of_guests: booking.number_of_guests,
      },
      charges: folioCharges,
      payments: payments,
      taxes: taxes,
      totals: {
        subtotal,
        cgst_amount: cgstAmount,
        sgst_amount: sgstAmount,
        grand_total: grandTotal,
        total_paid: totalPaid,
        balance,
      },
      hotel: {
        name: hotelConfig.name,
        address: hotelConfig.address.full,
        phone: hotelConfig.contact.phone,
        email: hotelConfig.contact.email,
        gstin: hotelConfig.gstin,
      },
      document_date: documentDate,
    };

    const documentHtml = generateInvoiceHTML(documentNumber, documentData);

    const { error } = await supabase.from('guest_documents').insert([
      {
        booking_id: booking.id,
        guest_id: booking.guests.id,
        document_type: 'invoice',
        document_number: documentNumber,
        document_html: documentHtml,
        document_data: documentData,
      },
    ]);

    if (error) throw error;

    return { success: true, documentNumber };
  } catch (error) {
    const err = error as { message?: string };
    return { success: false, error: err.message || 'Failed to archive invoice' };
  }
}

/**
 * Archive GRC document on checkout
 */
export async function archiveGRC(
  booking: BookingData,
  taxes: TaxConfig
): Promise<{ success: boolean; documentNumber?: string; error?: string }> {
  try {
    const documentNumber = `${hotelConfig.grc.prefix}-${booking.id.slice(0, 8).toUpperCase()}`;
    const documentDate = new Date().toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

    const documentData: DocumentData = {
      guest: {
        id: booking.guests.id,
        full_name: booking.guests.full_name,
        mobile: booking.guests.mobile,
        email: booking.guests.email,
        address: booking.guests.address,
        id_proof_type: booking.guests.id_proof_type,
        id_proof_number: booking.guests.id_proof_number,
      },
      room: {
        room_number: booking.rooms.room_number,
        room_type: booking.rooms.room_types.name,
        base_rate: booking.rooms.room_types.base_rate,
      },
      stay: {
        check_in_date: booking.check_in_date,
        check_out_date: booking.actual_check_out_date || booking.expected_check_out_date,
        number_of_guests: booking.number_of_guests,
      },
      charges: [],
      payments: [],
      taxes: taxes,
      totals: {
        subtotal: 0,
        cgst_amount: 0,
        sgst_amount: 0,
        grand_total: 0,
        total_paid: 0,
        balance: 0,
      },
      hotel: {
        name: hotelConfig.name,
        address: hotelConfig.address.full,
        phone: hotelConfig.contact.phone,
        email: hotelConfig.contact.email,
        gstin: hotelConfig.gstin,
      },
      document_date: documentDate,
    };

    const documentHtml = generateGRCHTML(documentNumber, documentData);

    const { error } = await supabase.from('guest_documents').insert([
      {
        booking_id: booking.id,
        guest_id: booking.guests.id,
        document_type: 'grc',
        document_number: documentNumber,
        document_html: documentHtml,
        document_data: documentData,
      },
    ]);

    if (error) throw error;

    return { success: true, documentNumber };
  } catch (error) {
    const err = error as { message?: string };
    return { success: false, error: err.message || 'Failed to archive GRC' };
  }
}

/**
 * Fetch archived documents for a booking
 */
export async function getArchivedDocuments(bookingId: string) {
  const { data, error } = await supabase
    .from('guest_documents')
    .select('*')
    .eq('booking_id', bookingId)
    .order('created_at');

  if (error) throw error;
  return data || [];
}

/**
 * Fetch all archived documents for a guest
 */
export async function getGuestDocuments(guestId: string) {
  const { data, error } = await supabase
    .from('guest_documents')
    .select('*')
    .eq('guest_id', guestId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Export guest data as JSON for offline backup
 */
export async function exportGuestDataJSON(guestId: string) {
  // Fetch guest info
  const { data: guest } = await supabase
    .from('guests')
    .select('*')
    .eq('id', guestId)
    .single();

  // Fetch all bookings for guest
  const { data: bookings } = await supabase
    .from('bookings')
    .select('*, rooms(room_number, room_types(name, base_rate))')
    .eq('guest_id', guestId)
    .order('check_in_date', { ascending: false });

  // Fetch all documents
  const { data: documents } = await supabase
    .from('guest_documents')
    .select('document_type, document_number, document_data, created_at')
    .eq('guest_id', guestId)
    .order('created_at', { ascending: false });

  // Fetch all charges and payments for each booking
  const stayHistory = [];
  for (const booking of bookings || []) {
    const { data: charges } = await supabase
      .from('folio_charges')
      .select('*')
      .eq('booking_id', booking.id);

    const { data: payments } = await supabase
      .from('payments')
      .select('*')
      .eq('booking_id', booking.id);

    stayHistory.push({
      ...booking,
      charges: charges || [],
      payments: payments || [],
    });
  }

  const exportData = {
    export_date: new Date().toISOString(),
    export_type: 'guest_full_record',
    guest,
    stay_history: stayHistory,
    archived_documents: documents,
  };

  return exportData;
}

/**
 * Export all guests data for bulk backup (manager only)
 */
export async function exportAllGuestsData() {
  const { data: guests } = await supabase
    .from('guests')
    .select('*')
    .order('created_at', { ascending: false });

  const allData = [];
  for (const guest of guests || []) {
    const guestData = await exportGuestDataJSON(guest.id);
    allData.push(guestData);
  }

  return {
    export_date: new Date().toISOString(),
    export_type: 'bulk_guest_records',
    total_guests: allData.length,
    guests: allData,
  };
}

/**
 * Convert HTML document to downloadable blob
 */
export function downloadDocumentAsHTML(html: string, filename: string) {
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Download JSON data as file
 */
export function downloadJSON(data: unknown, filename: string) {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Convert guest data to CSV format
 */
export function convertToCSV(data: Record<string, unknown>[]): string {
  if (!data.length) return '';
  
  const headers = Object.keys(data[0]);
  const csvRows = [headers.join(',')];
  
  for (const row of data) {
    const values = headers.map(header => {
      const value = row[header];
      const escaped = String(value ?? '').replace(/"/g, '""');
      return `"${escaped}"`;
    });
    csvRows.push(values.join(','));
  }
  
  return csvRows.join('\n');
}

/**
 * Download CSV data as file
 */
export function downloadCSV(csvContent: string, filename: string) {
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
