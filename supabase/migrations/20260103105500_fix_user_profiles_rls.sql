/*
  # Fix User Profiles RLS Infinite Recursion
  
  The previous policies caused infinite recursion because they queried
  user_profiles to check if the user is a manager while trying to access user_profiles.
  
  Fix: Use auth.jwt() to avoid querying the table during policy evaluation.
*/

-- Drop the problematic policies
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Managers can view all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Managers can manage user profiles" ON user_profiles;

-- Create a simplified policy: authenticated users can view their own profile
CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Create policy for inserting own profile (after signup)
CREATE POLICY "Users can insert own profile"
  ON user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Create policy allowing users to update their own profile
CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- For manager access to ALL profiles, we need a security definer function
-- to avoid the recursion when checking roles

-- Create a helper function that bypasses RLS to check if user is manager
CREATE OR REPLACE FUNCTION is_manager()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND role = 'manager'
    AND is_active = true
  );
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION is_manager() TO authenticated;

-- Now create the manager policies using the helper function
CREATE POLICY "Managers can view all profiles"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (is_manager());

CREATE POLICY "Managers can update all profiles"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (is_manager())
  WITH CHECK (is_manager());

CREATE POLICY "Managers can delete profiles"
  ON user_profiles FOR DELETE
  TO authenticated
  USING (is_manager());
