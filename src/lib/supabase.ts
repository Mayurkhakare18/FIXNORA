// ==============================================================================
// SmartResolve Supabase Client Configuration
// Uses publishable anonymous key only; strictly client-safe
// ==============================================================================

import { createClient } from '@supabase/supabase-js';

const getEnv = (key: string): string => {
  if (typeof import.meta !== 'undefined' && (import.meta as any).env?.[key]) {
    return (import.meta as any).env[key];
  }
  if (typeof process !== 'undefined' && process.env?.[key]) {
    return process.env[key] || '';
  }
  return '';
};

const rawUrl = getEnv('VITE_SUPABASE_URL');
// Support VITE_SUPABASE_PUBLISHABLE_KEY as primary, with VITE_SUPABASE_ANON_KEY as fallback
const rawPublishableKey = getEnv('VITE_SUPABASE_PUBLISHABLE_KEY') || getEnv('VITE_SUPABASE_ANON_KEY');

// Clean and check if valid configuration is provided
const isPlaceholder = (val: string) =>
  !val ||
  val.includes('your-project-ref') ||
  val.includes('your-anon-publishable-key') ||
  val.includes('your-publishable-key') ||
  val.includes('uawgiemprtthbzdhulpb') ||
  val.trim() === '';

export const isSupabaseConfigured = !isPlaceholder(rawUrl) && !isPlaceholder(rawPublishableKey);

// Fallback dummy credentials to prevent createClient crashes when env is not yet filled
const supabaseUrl = isSupabaseConfigured ? rawUrl : 'https://unconfigured.supabase.co';
const supabaseKey = isSupabaseConfigured ? rawPublishableKey : 'unconfigured-anon-key';

export const supabase = createClient(supabaseUrl, supabaseKey, {
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
    : 'Supabase credentials missing. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to .env',
});
