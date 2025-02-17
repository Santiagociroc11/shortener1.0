import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

console.log("SUP1", supabaseUrl)
console.log("SUP2", supabaseAnonKey)

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Please click the "Connect to Supabase" button in the top right to set up your project');
}

// Validate URL format
try {
  new URL(supabaseUrl);
} catch (error) {
  throw new Error('Invalid Supabase URL format. Please ensure you have connected to Supabase correctly.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);