/*
  # Update RLS policies for links table
  
  1. Changes
    - Modified RLS policies to allow anonymous users to create links
    - Added policy for anonymous users to create links without user_id
    - Updated existing policies for authenticated users
  
  2. Security
    - Links are still readable by everyone
    - Authenticated users can manage their own links
    - Anonymous users can create links without user_id
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Links are readable by everyone" ON links;
DROP POLICY IF EXISTS "Users can insert their own links" ON links;
DROP POLICY IF EXISTS "Users can update their own links" ON links;
DROP POLICY IF EXISTS "Users can delete their own links" ON links;

-- Create new policies
CREATE POLICY "Links are readable by everyone" ON links
  FOR SELECT USING (true);

-- Allow anonymous users to create links without user_id
CREATE POLICY "Anonymous users can create links" ON links
  FOR INSERT TO anon
  WITH CHECK (user_id IS NULL);

-- Allow authenticated users to create their own links
CREATE POLICY "Users can create their own links" ON links
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Allow authenticated users to update their own links
CREATE POLICY "Users can update their own links" ON links
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- Allow authenticated users to delete their own links
CREATE POLICY "Users can delete their own links" ON links
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);