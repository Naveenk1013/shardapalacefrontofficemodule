/*
  # Rebuild Hotel PMS Schema

  Complete rebuild of the PMS schema with proper UUID types.
*/

-- Drop existing tables if they exist (in correct order due to foreign keys)
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS folio_charges CASCADE;
DROP TABLE IF EXISTS bookings CASCADE;
DROP TABLE IF EXISTS reservations CASCADE;
DROP TABLE IF EXISTS guests CASCADE;
DROP TABLE IF EXISTS rooms CASCADE;
DROP TABLE IF EXISTS room_types CASCADE;
DROP TABLE IF EXISTS tax_config CASCADE;
DROP TABLE IF EXISTS user_profiles CASCADE;

-- Create room_types table
CREATE TABLE room_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  base_rate decimal(10,2) NOT NULL,
  max_occupancy integer NOT NULL DEFAULT 2,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create rooms table
CREATE TABLE rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_number text UNIQUE NOT NULL,
  room_type_id uuid REFERENCES room_types(id) ON DELETE RESTRICT,
  floor integer NOT NULL,
  status text NOT NULL DEFAULT 'vacant_clean',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_status CHECK (status IN ('vacant_clean', 'vacant_dirty', 'occupied', 'out_of_order'))
);

-- Create guests table
CREATE TABLE guests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  mobile text UNIQUE NOT NULL,
  email text,
  address text,
  id_proof_type text,
  id_proof_number text,
  id_proof_image_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_id_proof_type CHECK (id_proof_type IN ('aadhaar', 'passport', 'driving_license', 'other', NULL))
);

-- Create reservations table
CREATE TABLE reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id uuid REFERENCES guests(id) ON DELETE CASCADE,
  room_type_id uuid REFERENCES room_types(id) ON DELETE RESTRICT,
  check_in_date date NOT NULL,
  check_out_date date NOT NULL,
  number_of_guests integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'confirmed',
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_reservation_status CHECK (status IN ('confirmed', 'cancelled', 'checked_in')),
  CONSTRAINT valid_dates CHECK (check_out_date > check_in_date)
);

-- Create bookings table
CREATE TABLE bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id uuid REFERENCES reservations(id) ON DELETE SET NULL,
  guest_id uuid REFERENCES guests(id) ON DELETE RESTRICT,
  room_id uuid REFERENCES rooms(id) ON DELETE RESTRICT,
  check_in_date timestamptz NOT NULL DEFAULT now(),
  expected_check_out_date date NOT NULL,
  actual_check_out_date timestamptz,
  number_of_guests integer NOT NULL DEFAULT 1,
  advance_payment decimal(10,2) DEFAULT 0,
  status text NOT NULL DEFAULT 'checked_in',
  checked_in_by uuid REFERENCES auth.users(id),
  checked_out_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_booking_status CHECK (status IN ('checked_in', 'checked_out'))
);

-- Create folio_charges table
CREATE TABLE folio_charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid REFERENCES bookings(id) ON DELETE CASCADE,
  charge_date date NOT NULL DEFAULT CURRENT_DATE,
  description text NOT NULL,
  amount decimal(10,2) NOT NULL,
  charge_type text NOT NULL,
  posted_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  CONSTRAINT valid_charge_type CHECK (charge_type IN ('room_rent', 'extra_bed', 'early_checkin', 'late_checkout', 'miscellaneous'))
);

-- Create payments table
CREATE TABLE payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid REFERENCES bookings(id) ON DELETE CASCADE,
  payment_date timestamptz NOT NULL DEFAULT now(),
  amount decimal(10,2) NOT NULL,
  payment_mode text NOT NULL,
  reference_number text,
  notes text,
  received_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  CONSTRAINT valid_payment_mode CHECK (payment_mode IN ('cash', 'upi', 'card'))
);

-- Create tax_config table
CREATE TABLE tax_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tax_name text UNIQUE NOT NULL,
  tax_percentage decimal(5,2) NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create user_profiles table
CREATE TABLE user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  role text NOT NULL DEFAULT 'staff',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_role CHECK (role IN ('staff', 'manager'))
);

-- Create indexes for performance
CREATE INDEX idx_rooms_status ON rooms(status);
CREATE INDEX idx_rooms_room_type ON rooms(room_type_id);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_dates ON bookings(check_in_date, expected_check_out_date);
CREATE INDEX idx_guests_mobile ON guests(mobile);
CREATE INDEX idx_reservations_dates ON reservations(check_in_date, check_out_date);
CREATE INDEX idx_folio_booking ON folio_charges(booking_id);
CREATE INDEX idx_payments_booking ON payments(booking_id);

-- Enable Row Level Security
ALTER TABLE room_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE folio_charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for room_types
CREATE POLICY "Authenticated users can view room types"
  ON room_types FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Managers can manage room types"
  ON room_types FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'manager'
      AND user_profiles.is_active = true
    )
  );

-- RLS Policies for rooms
CREATE POLICY "Authenticated users can view rooms"
  ON rooms FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can update room status"
  ON rooms FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Managers can manage rooms"
  ON rooms FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'manager'
      AND user_profiles.is_active = true
    )
  );

-- RLS Policies for guests
CREATE POLICY "Authenticated users can view guests"
  ON guests FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create guests"
  ON guests FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update guests"
  ON guests FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- RLS Policies for reservations
CREATE POLICY "Authenticated users can view reservations"
  ON reservations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create reservations"
  ON reservations FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update reservations"
  ON reservations FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- RLS Policies for bookings
CREATE POLICY "Authenticated users can view bookings"
  ON bookings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create bookings"
  ON bookings FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update bookings"
  ON bookings FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- RLS Policies for folio_charges
CREATE POLICY "Authenticated users can view folio charges"
  ON folio_charges FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create folio charges"
  ON folio_charges FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- RLS Policies for payments
CREATE POLICY "Authenticated users can view payments"
  ON payments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create payments"
  ON payments FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- RLS Policies for tax_config
CREATE POLICY "Authenticated users can view tax config"
  ON tax_config FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Managers can manage tax config"
  ON tax_config FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'manager'
      AND user_profiles.is_active = true
    )
  );

-- RLS Policies for user_profiles
CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Managers can view all profiles"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
      AND up.role = 'manager'
      AND up.is_active = true
    )
  );

CREATE POLICY "Managers can manage user profiles"
  ON user_profiles FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'manager'
      AND user_profiles.is_active = true
    )
  );

-- Insert default tax configuration
INSERT INTO tax_config (tax_name, tax_percentage, is_active)
VALUES 
  ('CGST', 6.00, true),
  ('SGST', 6.00, true)
ON CONFLICT (tax_name) DO NOTHING;

-- Insert sample room types
INSERT INTO room_types (name, base_rate, max_occupancy, description)
VALUES 
  ('Standard', 1500.00, 2, 'Comfortable room with basic amenities'),
  ('Deluxe', 2500.00, 2, 'Spacious room with premium amenities'),
  ('Family Suite', 4000.00, 4, 'Large suite perfect for families')
ON CONFLICT DO NOTHING;

-- Insert sample rooms
DO $$
DECLARE
  standard_id uuid;
  deluxe_id uuid;
  family_id uuid;
BEGIN
  SELECT id INTO standard_id FROM room_types WHERE name = 'Standard' LIMIT 1;
  SELECT id INTO deluxe_id FROM room_types WHERE name = 'Deluxe' LIMIT 1;
  SELECT id INTO family_id FROM room_types WHERE name = 'Family Suite' LIMIT 1;

  IF standard_id IS NOT NULL AND deluxe_id IS NOT NULL AND family_id IS NOT NULL THEN
    INSERT INTO rooms (room_number, room_type_id, floor, status)
    SELECT * FROM (VALUES
      ('101', standard_id, 1, 'vacant_clean'),
      ('102', standard_id, 1, 'vacant_clean'),
      ('103', deluxe_id, 1, 'vacant_clean'),
      ('104', deluxe_id, 1, 'vacant_clean'),
      ('105', family_id, 1, 'vacant_clean'),
      ('201', standard_id, 2, 'vacant_clean'),
      ('202', standard_id, 2, 'vacant_clean'),
      ('203', deluxe_id, 2, 'vacant_clean'),
      ('204', deluxe_id, 2, 'vacant_clean'),
      ('205', family_id, 2, 'vacant_clean')
    ) AS data(room_number, room_type_id, floor, status)
    WHERE NOT EXISTS (
      SELECT 1 FROM rooms WHERE rooms.room_number = data.room_number
    );
  END IF;
END $$;