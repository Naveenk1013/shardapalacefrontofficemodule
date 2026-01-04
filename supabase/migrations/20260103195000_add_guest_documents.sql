/*
  # Guest Documents Archive Table
  
  Stores archived Invoice and GRC documents for legal compliance.
  Documents are preserved as HTML snapshots + structured JSON data.
*/

-- Create guest_documents table
CREATE TABLE guest_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid REFERENCES bookings(id) ON DELETE SET NULL,
  guest_id uuid NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
  document_type text NOT NULL,
  document_number text NOT NULL,
  document_html text NOT NULL,
  document_data jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT valid_document_type CHECK (document_type IN ('invoice', 'grc'))
);

-- Create indexes for efficient querying
CREATE INDEX idx_guest_documents_booking ON guest_documents(booking_id);
CREATE INDEX idx_guest_documents_guest ON guest_documents(guest_id);
CREATE INDEX idx_guest_documents_type ON guest_documents(document_type);
CREATE INDEX idx_guest_documents_number ON guest_documents(document_number);

-- Enable Row Level Security
ALTER TABLE guest_documents ENABLE ROW LEVEL SECURITY;

-- RLS Policies for guest_documents
CREATE POLICY "Authenticated users can view guest documents"
  ON guest_documents FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create guest documents"
  ON guest_documents FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Note: Documents should never be deleted (legal requirement)
-- No DELETE policy is intentional
