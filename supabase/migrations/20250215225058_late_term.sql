/*
  # URL Shortener Schema

  1. New Tables
    - `links`
      - `id` (uuid, primary key)
      - `original_url` (text, the original long URL)
      - `short_url` (text, unique short code)
      - `script_code` (text, tracking/analytics scripts)
      - `visits` (integer, visit counter)
      - `created_at` (timestamp)
      - `user_id` (uuid, references auth.users)

  2. Security
    - Enable RLS on `links` table
    - Add policies for:
      - Anyone can read links (for redirection)
      - Authenticated users can create/update/delete their own links
*/

CREATE TABLE IF NOT EXISTS links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  original_url text NOT NULL,
  short_url text NOT NULL UNIQUE,
  script_code text,
  visits integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  user_id uuid REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE links ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Links are readable by everyone" ON links
  FOR SELECT USING (true);

CREATE POLICY "Users can insert their own links" ON links
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own links" ON links
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own links" ON links
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS links_short_url_idx ON links(short_url);