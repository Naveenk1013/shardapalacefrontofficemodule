# Hotel Front Office PMS - Setup Guide

Welcome to your new Hotel Property Management System! This guide will help you get started.

## Features Implemented

### Core Modules
- User Authentication with Role-Based Access (Staff & Manager)
- Real-time Room Availability Dashboard
- Reservation Management
- Guest Profile & KYC Management
- Check-In Process
- In-House Guest Management
- Billing & Folio System
- Check-Out Process with Payment
- Manager Reports

## Getting Started

### 1. Create Your First User Account

You need to create a user account in Supabase:

1. Go to your Supabase project dashboard
2. Navigate to **Authentication** → **Users**
3. Click **Add User**
4. Enter email and password
5. Click **Create User**

### 2. Add User Profile

After creating the authentication user, you need to add their profile:

1. Go to **Table Editor** → **user_profiles**
2. Click **Insert** → **Insert Row**
3. Fill in:
   - `id`: Copy the user ID from the auth.users table
   - `full_name`: Enter the user's full name
   - `role`: Choose either `staff` or `manager`
   - `is_active`: Set to `true`
4. Click **Save**

**Important:** Create at least one manager account first so you can configure the system.

### 3. Configure Room Types (Manager Only)

1. Log in with a manager account
2. Navigate to **Settings** → **Room Types**
3. Add your room types (e.g., Standard, Deluxe, Suite)
   - Name
   - Base Rate (per night)
   - Max Occupancy
   - Description

### 4. Add Rooms (Manager Only)

1. In Settings, go to **Rooms** tab
2. Add each room in your property:
   - Room Number
   - Room Type
   - Floor
   - Initial Status (usually "Vacant Clean")

### 5. Start Operations

Now you're ready to:
- Create reservations
- Perform check-ins (walk-in or from reservations)
- Manage in-house guests
- Post charges to folios
- Complete check-outs with billing

## User Roles

### Staff
- View Dashboard
- Create Reservations
- View Guests
- Check-In Guests
- Manage In-House Guests
- Post Charges
- Check-Out Guests

### Manager
All staff permissions plus:
- View Reports
- Configure Room Types
- Manage Rooms
- Configure Tax Settings
- View Revenue Reports

## Quick Workflow

### For Reservations
1. Go to **Reservations**
2. Click **New Reservation**
3. Enter guest details and booking information
4. Click **Create Reservation**

### For Check-In
1. Go to **Guests**
2. Search for the guest or select from list
3. Click **View Details**
4. If they have a reservation, click **Check In** on the reservation
5. If walk-in, click **Walk-In Check In**
6. Select room, enter details, collect advance payment
7. Click **Complete Check-In**

### For Check-Out
1. Go to **In-House**
2. Select the booking
3. Review folio charges
4. Click **Check Out**
5. Collect final payment
6. Click **Complete Check-Out**

## Tips

- **Room Status**: Updates automatically on check-in/check-out
- **Folio Charges**: Room rent is auto-posted during check-in
- **GST**: Configured at 12% (6% CGST + 6% SGST)
- **Reports**: Available to managers for business insights
- **Search**: Use guest name or mobile number to quickly find guests

## Support

For any issues or questions, refer to the detailed module documentation or contact your system administrator.

---

Happy Hotel Management!
