// ==============================================================================
// SmartResolve Supabase Client Configuration
// Uses publishable anonymous key only; strictly client-safe
// ==============================================================================

import { createClient } from '@supabase/supabase-js';

const rawUrl = (typeof import.meta !== 'undefined' && (import.meta as any).env ? (import.meta as any).env.VITE_SUPABASE_URL : (typeof process !== 'undefined' ? process.env?.VITE_SUPABASE_URL : '')) || '';
const rawAnonKey = (typeof import.meta !== 'undefined' && (import.meta as any).env ? (import.meta as any).env.VITE_SUPABASE_ANON_KEY : (typeof process !== 'undefined' ? process.env?.VITE_SUPABASE_ANON_KEY : '')) || '';

// Clean and check if valid configuration is provided
const isPlaceholder = (val: string) =>
  !val ||
  val.includes('your-project-ref') ||
  val.includes('your-anon-publishable-key') ||
  val.trim() === '';

export const isSupabaseConfigured = !isPlaceholder(rawUrl) && !isPlaceholder(rawAnonKey);

// Fallback dummy credentials to prevent createClient crashes when env is not yet filled
const supabaseUrl = isSupabaseConfigured ? rawUrl : 'https://unconfigured.supabase.co';
const supabaseAnonKey = isSupabaseConfigured ? rawAnonKey : 'unconfigured-anon-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'smartresolve_auth_token',
  },
});

export const getSupabaseConfigStatus = () => ({
  isConfigured: isSupabaseConfigured,
  url: isSupabaseConfigured ? rawUrl : null,
  message: isSupabaseConfigured
    ? 'Connected to configured Supabase project'
    : 'Supabase credentials missing. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env',
});
