import { hotelConfig } from '../lib/hotelConfig';

interface InvoiceProps {
  booking: {
    id: string;
    check_in_date: string;
    expected_check_out_date: string;
    actual_check_out_date?: string;
    number_of_guests: number;
    guests: {
      full_name: string;
      mobile: string;
      address?: string;
    };
    rooms: {
      room_number: string;
      room_types: {
        name: string;
        base_rate: number;
      };
    };
  };
  folioCharges: Array<{
    id: string;
    charge_date: string;
    description: string;
    amount: number;
    charge_type: string;
  }>;
  payments: Array<{
    id: string;
    payment_date: string;
    amount: number;
    payment_mode: string;
  }>;
  taxes: {
    cgst: number;
    sgst: number;
  };
}

export default function Invoice({ booking, folioCharges, payments, taxes }: InvoiceProps) {
  const invoiceNumber = `${hotelConfig.invoice.prefix}-${booking.id.slice(0, 8).toUpperCase()}`;
  const invoiceDate = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const subtotal = folioCharges.reduce((sum, charge) => sum + Number(charge.amount), 0);
  const cgstAmount = (subtotal * taxes.cgst) / 100;
  const sgstAmount = (subtotal * taxes.sgst) / 100;
  const grandTotal = subtotal + cgstAmount + sgstAmount;
  const totalPaid = payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
  const balance = grandTotal - totalPaid;

  const checkInDate = new Date(booking.check_in_date).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  
  const checkOutDate = new Date(booking.actual_check_out_date || booking.expected_check_out_date).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  return (
    <div className="invoice-container bg-white p-8 max-w-[210mm] mx-auto font-sans">
      {/* Header */}
      <div className="border-b-2 border-gray-800 pb-4 mb-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{hotelConfig.name}</h1>
            <p className="text-gray-600 mt-1">{hotelConfig.address.line1}</p>
            <p className="text-gray-600">{hotelConfig.address.line2}</p>
            <p className="text-gray-600 text-sm mt-2">
              📞 {hotelConfig.contact.phone} | ✉️ {hotelConfig.contact.email}
            </p>
            <p className="text-gray-600 text-sm">GSTIN: {hotelConfig.gstin}</p>
          </div>
          <div className="text-right">
            <h2 className="text-2xl font-bold text-blue-700">TAX INVOICE</h2>
            <p className="text-gray-700 mt-2">
              <span className="font-semibold">Invoice No:</span> {invoiceNumber}
            </p>
            <p className="text-gray-700">
              <span className="font-semibold">Date:</span> {invoiceDate}
            </p>
          </div>
        </div>
      </div>

      {/* Guest Details */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="font-semibold text-gray-800 mb-2">Bill To:</h3>
          <p className="font-medium text-gray-900">{booking.guests.full_name}</p>
          <p className="text-gray-600">📱 {booking.guests.mobile}</p>
          {booking.guests.address && (
            <p className="text-gray-600 text-sm mt-1">{booking.guests.address}</p>
          )}
        </div>
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="font-semibold text-gray-800 mb-2">Stay Details:</h3>
          <p className="text-gray-700">
            <span className="font-medium">Room:</span> {booking.rooms.room_number} ({booking.rooms.room_types.name})
          </p>
          <p className="text-gray-700">
            <span className="font-medium">Check-In:</span> {checkInDate}
          </p>
          <p className="text-gray-700">
            <span className="font-medium">Check-Out:</span> {checkOutDate}
          </p>
          <p className="text-gray-700">
            <span className="font-medium">Guests:</span> {booking.number_of_guests}
          </p>
        </div>
      </div>

      {/* Charges Table */}
      <table className="w-full mb-6">
        <thead>
          <tr className="bg-gray-800 text-white">
            <th className="px-4 py-2 text-left text-sm">Date</th>
            <th className="px-4 py-2 text-left text-sm">Description</th>
            <th className="px-4 py-2 text-right text-sm">Amount (₹)</th>
          </tr>
        </thead>
        <tbody>
          {folioCharges.map((charge, index) => (
            <tr key={charge.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
              <td className="px-4 py-2 text-sm text-gray-700">
                {new Date(charge.charge_date).toLocaleDateString('en-IN')}
              </td>
              <td className="px-4 py-2 text-sm text-gray-800">{charge.description}</td>
              <td className="px-4 py-2 text-sm text-gray-800 text-right">₹{charge.amount.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div className="flex justify-end mb-6">
        <div className="w-72">
          <div className="flex justify-between py-1 text-gray-700">
            <span>Subtotal</span>
            <span>₹{subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between py-1 text-gray-700">
            <span>CGST ({taxes.cgst}%)</span>
            <span>₹{cgstAmount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between py-1 text-gray-700">
            <span>SGST ({taxes.sgst}%)</span>
            <span>₹{sgstAmount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between py-2 text-lg font-bold border-t-2 border-gray-800 mt-2">
            <span>Grand Total</span>
            <span>₹{grandTotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between py-1 text-green-700">
            <span>Amount Paid</span>
            <span>₹{totalPaid.toFixed(2)}</span>
          </div>
          {balance > 0 && (
            <div className="flex justify-between py-1 text-red-700 font-semibold">
              <span>Balance Due</span>
              <span>₹{balance.toFixed(2)}</span>
            </div>
          )}
          {balance <= 0 && (
            <div className="flex justify-between py-1 text-green-700 font-semibold">
              <span>Status</span>
              <span>PAID ✓</span>
            </div>
          )}
        </div>
      </div>

      {/* Payment History */}
      {payments.length > 0 && (
        <div className="mb-6">
          <h3 className="font-semibold text-gray-800 mb-2 text-sm">Payment History:</h3>
          <div className="text-sm text-gray-600">
            {payments.map((payment) => (
              <div key={payment.id} className="flex justify-between py-1">
                <span>
                  {new Date(payment.payment_date).toLocaleDateString('en-IN')} - {payment.payment_mode.toUpperCase()}
                </span>
                <span>₹{payment.amount.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Terms */}
      <div className="border-t pt-4 mt-6">
        <h4 className="font-semibold text-gray-700 text-sm mb-2">Terms & Conditions:</h4>
        <ul className="text-xs text-gray-600 list-disc list-inside">
          {hotelConfig.invoice.termsAndConditions.map((term, index) => (
            <li key={index}>{term}</li>
          ))}
        </ul>
      </div>

      {/* Footer */}
      <div className="mt-8 pt-4 border-t text-center text-gray-600 text-sm">
        <p>Thank you for staying with us!</p>
        <p className="font-semibold text-gray-800">{hotelConfig.name}</p>
      </div>
    </div>
  );
}
