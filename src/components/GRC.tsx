import { hotelConfig } from '../lib/hotelConfig';

interface GRCProps {
  booking: {
    id: string;
    check_in_date: string;
    expected_check_out_date: string;
    number_of_guests: number;
    guests: {
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
      };
    };
  };
}

export default function GRC({ booking }: GRCProps) {
  const grcNumber = `${hotelConfig.grc.prefix}-${booking.id.slice(0, 8).toUpperCase()}`;
  const currentDate = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const currentTime = new Date().toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const checkInDate = new Date(booking.check_in_date).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const checkInTime = new Date(booking.check_in_date).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const checkOutDate = new Date(booking.expected_check_out_date).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

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

  return (
    <div className="grc-container bg-white p-8 max-w-[210mm] mx-auto font-sans">
      {/* Header */}
      <div className="border-b-2 border-gray-800 pb-4 mb-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">{hotelConfig.name}</h1>
          <p className="text-gray-600 mt-1">{hotelConfig.address.full}</p>
          <p className="text-gray-600 text-sm">
            📞 {hotelConfig.contact.phone} | ✉️ {hotelConfig.contact.email}
          </p>
        </div>
        <div className="mt-4 text-center">
          <h2 className="text-xl font-bold text-blue-700 uppercase tracking-wide">
            {hotelConfig.grc.formTitle}
          </h2>
          <p className="text-gray-600 text-sm">(Form C - As per Government Regulations)</p>
        </div>
      </div>

      {/* GRC Details */}
      <div className="flex justify-between mb-6 text-gray-700">
        <p><span className="font-semibold">GRC No:</span> {grcNumber}</p>
        <p><span className="font-semibold">Date:</span> {currentDate} | {currentTime}</p>
      </div>

      {/* Guest Information */}
      <div className="border border-gray-300 rounded-lg p-4 mb-6">
        <h3 className="font-bold text-gray-800 mb-4 pb-2 border-b">Guest Information</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-600">Full Name</p>
            <p className="font-medium text-gray-900">{booking.guests.full_name}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Mobile Number</p>
            <p className="font-medium text-gray-900">{booking.guests.mobile}</p>
          </div>
          {booking.guests.email && (
            <div>
              <p className="text-sm text-gray-600">Email</p>
              <p className="font-medium text-gray-900">{booking.guests.email}</p>
            </div>
          )}
          <div>
            <p className="text-sm text-gray-600">Number of Guests</p>
            <p className="font-medium text-gray-900">{booking.number_of_guests}</p>
          </div>
          {booking.guests.address && (
            <div className="col-span-2">
              <p className="text-sm text-gray-600">Address</p>
              <p className="font-medium text-gray-900">{booking.guests.address}</p>
            </div>
          )}
        </div>
      </div>

      {/* ID Proof */}
      <div className="border border-gray-300 rounded-lg p-4 mb-6">
        <h3 className="font-bold text-gray-800 mb-4 pb-2 border-b">Identity Verification</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-600">ID Proof Type</p>
            <p className="font-medium text-gray-900">{formatIdProofType(booking.guests.id_proof_type)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">ID Proof Number</p>
            <p className="font-medium text-gray-900">{booking.guests.id_proof_number || 'N/A'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Nationality</p>
            <p className="font-medium text-gray-900">Indian</p>
          </div>
        </div>
      </div>

      {/* Room Details */}
      <div className="border border-gray-300 rounded-lg p-4 mb-6">
        <h3 className="font-bold text-gray-800 mb-4 pb-2 border-b">Accommodation Details</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-600">Room Number</p>
            <p className="font-medium text-gray-900 text-lg">{booking.rooms.room_number}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Room Type</p>
            <p className="font-medium text-gray-900">{booking.rooms.room_types.name}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Check-In Date & Time</p>
            <p className="font-medium text-gray-900">{checkInDate} at {checkInTime}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Expected Check-Out Date</p>
            <p className="font-medium text-gray-900">{checkOutDate}</p>
          </div>
        </div>
      </div>

      {/* Declaration */}
      <div className="bg-gray-50 border border-gray-300 rounded-lg p-4 mb-8">
        <p className="text-sm text-gray-700">
          I hereby declare that the information provided above is true and correct to the best of my knowledge.
          I agree to abide by the hotel rules and regulations during my stay.
        </p>
      </div>

      {/* Signatures */}
      <div className="grid grid-cols-2 gap-8 mt-12">
        <div className="text-center">
          <div className="border-t border-gray-400 pt-2 mx-8">
            <p className="text-sm text-gray-600">Guest Signature</p>
            <p className="font-medium text-gray-800 mt-1">{booking.guests.full_name}</p>
          </div>
        </div>
        <div className="text-center">
          <div className="border-t border-gray-400 pt-2 mx-8">
            <p className="text-sm text-gray-600">Front Desk Signature</p>
            <p className="font-medium text-gray-800 mt-1">Authorized Signatory</p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-12 pt-4 border-t text-center text-gray-600 text-sm">
        <p>Thank you for choosing {hotelConfig.name}</p>
        <p className="text-xs mt-1">This is a computer-generated document</p>
      </div>
    </div>
  );
}
