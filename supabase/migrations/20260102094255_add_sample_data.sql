/*
  # Sample Data for Hotel PMS

  ## Purpose
  Adds sample room types and rooms to help users get started quickly.
  This migration can be safely run and will only insert data if it doesn't already exist.

  ## Sample Data

  ### Room Types
  - Standard Room (₹1500/night, 2 guests)
  - Deluxe Room (₹2500/night, 2 guests)
  - Family Suite (₹4000/night, 4 guests)

  ### Rooms
  - 10 rooms across 2 floors
  - Mix of Standard, Deluxe, and Family room types
  - All initially set to "vacant_clean" status

  ## Notes
  - This is sample data to demonstrate the system
  - Managers can modify or delete this data through the Settings interface
  - Room numbers follow format: Floor + Room Number (e.g., 101, 102, 201, 202)
*/

-- Insert sample room types
INSERT INTO room_types (name, base_rate, max_occupancy, description)
VALUES 
  ('Standard', 1500.00, 2, 'Comfortable room with basic amenities'),
  ('Deluxe', 2500.00, 2, 'Spacious room with premium amenities'),
  ('Family Suite', 4000.00, 4, 'Large suite perfect for families')
ON CONFLICT DO NOTHING;

-- Insert sample rooms
-- Note: We need to get the room_type_id from the room_types table
DO $$
DECLARE
  standard_id uuid;
  deluxe_id uuid;
  family_id uuid;
BEGIN
  -- Get room type IDs
  SELECT id INTO standard_id FROM room_types WHERE name = 'Standard' LIMIT 1;
  SELECT id INTO deluxe_id FROM room_types WHERE name = 'Deluxe' LIMIT 1;
  SELECT id INTO family_id FROM room_types WHERE name = 'Family Suite' LIMIT 1;

  -- Only insert if room types exist
  IF standard_id IS NOT NULL AND deluxe_id IS NOT NULL AND family_id IS NOT NULL THEN
    -- Insert rooms if they don't exist
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