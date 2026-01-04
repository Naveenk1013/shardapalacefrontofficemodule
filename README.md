# Hotel Front Office PMS

A lightweight, production-ready Property Management System designed for budget hotels to manage their front office operations efficiently.

## Features

### For Front Desk Staff
- **Real-time Dashboard**: View room availability, occupancy, and today's arrivals/departures at a glance
- **Reservation Management**: Create and manage future bookings with ease
- **Guest Management**: Maintain comprehensive guest profiles with KYC details
- **Quick Check-In**: Fast check-in process for both walk-ins and reservations (under 2 minutes)
- **In-House Management**: Track active bookings, post charges, and manage guest folios
- **Seamless Check-Out**: Complete billing with GST calculation and multiple payment modes

### For Managers
All staff features plus:
- **Business Reports**: Daily arrivals, departures, occupancy, and revenue reports
- **Room Configuration**: Manage room types, rooms, and pricing
- **Tax Settings**: Configure GST rates
- **Revenue Analytics**: Track daily and monthly revenue

## Technology Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Backend**: Supabase (PostgreSQL + Authentication)
- **Database**: PostgreSQL with Row Level Security

## Quick Start

### Prerequisites
- Node.js 18+ installed
- Supabase account and project

### Installation

1. Install dependencies:
```bash
npm install
```

2. The system is pre-configured with Supabase credentials in `.env`

3. Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:5173`

### Initial Setup

Before using the system, you need to create your first user account. Follow the detailed instructions in [SETUP.md](./SETUP.md).

**Quick Setup Steps:**
1. Create a user in Supabase Authentication
2. Add user profile with role (staff or manager)
3. Log in and configure room types and rooms (manager only)
4. Start managing your hotel operations

## System Architecture

### Database Schema

The system uses 9 main tables:
- `user_profiles`: Extended user information with roles
- `room_types`: Room categories with pricing
- `rooms`: Individual room inventory
- `guests`: Guest profiles with KYC
- `reservations`: Future bookings
- `bookings`: Active check-ins
- `folio_charges`: Guest charges and billing
- `payments`: Payment records
- `tax_config`: GST configuration

### Security

- Row Level Security (RLS) enabled on all tables
- Role-based access control (Staff vs Manager)
- Secure authentication with Supabase
- Password hashing
- Session management with automatic timeout

## Key Workflows

### Creating a Reservation
1. Navigate to Reservations
2. Click "New Reservation"
3. Enter guest and booking details
4. System validates dates and availability
5. Confirmation created

### Check-In Process
1. Go to Guests page
2. Search for guest by name or mobile
3. Select guest and view details
4. Choose reservation or walk-in option
5. Assign available room
6. Collect ID proof (if not already on file)
7. Enter expected checkout date
8. Collect advance payment (optional)
9. System auto-posts room charges for entire stay
10. Room status changes to "Occupied"

### Managing In-House Guests
1. Navigate to In-House page
2. Select booking from active list
3. View complete folio with all charges
4. Add additional charges (extra bed, late checkout, etc.)
5. View real-time balance due

### Check-Out Process
1. In-House page → Select booking
2. Review complete folio
3. System calculates total with GST (12%)
4. Click "Check Out"
5. Collect final payment
6. Select payment mode (Cash/UPI/Card)
7. Invoice generated
8. Room status changes to "Vacant Dirty"

## Billing & GST

- **Base Calculation**: Room charges + additional services
- **GST**: 12% (6% CGST + 6% SGST)
- **Final Bill**: Subtotal + GST - Payments = Balance Due
- **Payment Modes**: Cash, UPI, Card

## Reports (Manager Only)

### Available Reports
- Today's Arrivals
- Today's Departures
- In-House Guest List
- Occupancy Report
- Daily Revenue
- Month-to-Date Revenue

### Export Options
- PDF (planned)
- Excel (planned)

## User Roles & Permissions

### Staff Role
Can perform:
- View dashboard
- Create reservations
- Check-in guests
- Manage in-house guests
- Post charges
- Check-out guests

Cannot access:
- Reports
- Settings
- Room/Rate configuration

### Manager Role
- All staff permissions
- View and export reports
- Configure room types and rooms
- Manage tax settings
- View revenue analytics

## Best Practices

1. **Always verify guest ID** before check-in
2. **Post room charges daily** during check-in
3. **Review folios** before check-out
4. **Update room status** is automatic but verify if needed
5. **Collect advance payments** to minimize check-out delays
6. **Clean rooms promptly** - status changes to "Vacant Dirty" after checkout

## Troubleshooting

### Cannot login
- Verify email and password
- Check that user profile exists with correct user ID
- Ensure `is_active` is set to `true`

### Room not showing as available
- Check room status in Settings
- Verify no active booking exists for the room
- Ensure room is set to "Vacant Clean"

### Cannot access Settings/Reports
- Verify your account has `manager` role
- Only managers can access these features

## Sample Data

The system includes sample data:
- 3 room types (Standard, Deluxe, Family Suite)
- 10 rooms across 2 floors
- Pre-configured GST rates (6% CGST + 6% SGST)

Managers can modify or delete this sample data through the Settings interface.

## Production Deployment

### Build for Production
```bash
npm run build
```

### Environment Variables
The following variables are pre-configured in `.env`:
- `VITE_SUPABASE_URL`: Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY`: Your Supabase anonymous key

## MVP Scope

This is an MVP (Minimum Viable Product) focused on core operations:

**Included:**
- Single property management
- Manual tariff setup
- Basic reporting
- Essential front desk operations
- GST-compliant billing

**Not Included (Future Enhancements):**
- Channel manager integration
- Dynamic pricing
- Restaurant POS integration
- Advanced analytics
- Email notifications
- SMS integration
- Online booking widget
- Multi-property support

## Support & Documentation

- **Setup Guide**: See [SETUP.md](./SETUP.md) for detailed setup instructions
- **Database Schema**: Check migration files in `supabase/migrations/`
- **Code Documentation**: Inline comments throughout the codebase

## Success Metrics

The system is designed to meet these MVP success criteria:
- ✅ Check-in completed in under 2 minutes
- ✅ Zero double room allocation (enforced by database)
- ✅ GST-compliant accurate billing
- ✅ Daily revenue visible without manual registers
- ✅ Minimal training required (intuitive UI)

## License

Private project - All rights reserved

---

Built with ❤️ for efficient hotel management
