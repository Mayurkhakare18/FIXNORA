// ==============================================================================
// SmartResolve Authentication & Role Authorization Context
// Multi-tenant society membership, role guards, and profile management
// ==============================================================================

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Profile, Society, SocietyMembership } from '../types/database';

export interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  memberships: SocietyMembership[];
  societies: Society[];
  currentSociety: Society | null;
  currentMembership: SocietyMembership | null;
  isLoading: boolean;
  isConfigured: boolean;
  error: string | null;
  clearError: () => void;
  signIn: (email: string, password: string) => Promise<{
    success: boolean;
    error?: string;
    memberships?: SocietyMembership[];
    currentMembership?: SocietyMembership | null;
  }>;
  signUp: (email: string, password: string, fullName: string, preferredLanguage?: 'en' | 'hi' | 'mr') => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
  updatePassword: (newPassword: string) => Promise<{ success: boolean; error?: string }>;
  selectSociety: (societyId: string) => void;
  requestSocietyMembership: (societyId: string, flatId?: string | null) => Promise<{
    success: boolean;
    error?: string;
    code?: 'ALREADY_ACTIVE' | 'ALREADY_PENDING' | 'MEMBERSHIP_INACTIVE' | 'DUPLICATE_MEMBERSHIP' | 'SERVER_ERROR';
    existingMembership?: SocietyMembership;
  }>;
  approveMembership: (membershipId: string) => Promise<{ success: boolean; error?: string }>;
  rejectMembership: (membershipId: string) => Promise<{ success: boolean; error?: string }>;
  enrollStaffMember: (
    societyId: string,
    targetUserId: string,
    role: 'maintenance_staff' | 'supervisor',
    designation: string
  ) => Promise<{ success: boolean; error?: string }>;
  refreshData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [memberships, setMemberships] = useState<SocietyMembership[]>([]);
  const [societies, setSocieties] = useState<Society[]>([]);
  const [currentSociety, setCurrentSociety] = useState<Society | null>(null);
  const [currentMembership, setCurrentMembership] = useState<SocietyMembership | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const clearError = () => setError(null);

  // Fetch Profile & Memberships for the authenticated user
  const fetchUserData = useCallback(async (userId: string) => {
    if (!isSupabaseConfigured) return;

    try {
      // 1. Fetch Profile
      const { data: profileData, error: profileErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (profileErr) {
        console.warn('Profile fetch warning:', profileErr.message);
      } else if (profileData) {
        setProfile(profileData as Profile);
      }

      // 2. Fetch User's Memberships across all societies
      const { data: memberData, error: memberErr } = await supabase
        .from('society_memberships')
        .select('*')
        .eq('user_id', userId);

      if (memberErr) {
        console.warn('Memberships fetch warning:', memberErr.message);
        return;
      }

      const userMemberships = (memberData || []) as SocietyMembership[];
      setMemberships(userMemberships);

      // 3. Fetch Societies associated with these memberships
      let loadedSocieties: Society[] = [];
      let activeMembership: SocietyMembership | null = null;
      let matchingSociety: Society | null = null;

      if (userMemberships.length > 0) {
        const societyIds = Array.from(new Set(userMemberships.map((m) => m.society_id)));
        const { data: societyData, error: socErr } = await supabase
          .from('societies')
          .select('*')
          .in('id', societyIds);

        if (!socErr && societyData) {
          loadedSocieties = societyData as Society[];
          setSocieties(loadedSocieties);

          // Select first active membership by default, or fallback to first pending
          activeMembership = userMemberships.find((m) => m.status === 'active') || userMemberships[0];
          setCurrentMembership(activeMembership);

          matchingSociety = loadedSocieties.find((s) => s.id === activeMembership!.society_id) || null;
          if (matchingSociety) {
            setCurrentSociety(matchingSociety);
          }
        }
      } else {
        setSocieties([]);
        setCurrentSociety(null);
        setCurrentMembership(null);
      }

      return {
        profile: profileData as Profile | null,
        memberships: userMemberships,
        currentMembership: activeMembership,
        societies: loadedSocieties,
        currentSociety: matchingSociety,
      };
    } catch (err: any) {
      console.error('Error fetching user context:', err);
      return null;
    }
  }, []);

  // Helper to establish a demo/seeded session for local testing or demo environments
  const establishDemoSession = (role: 'society_admin' | 'resident' | 'maintenance_staff', email: string) => {
    const isSocietyAdmin = role === 'society_admin';
    const isStaff = role === 'maintenance_staff';

    const mockSocId = isSocietyAdmin ? '11111111-1111-1111-1111-111111111111' : '22222222-2222-2222-2222-222222222222';
    const mockSocName = isSocietyAdmin ? 'Emerald Heights Co-op' : 'Sapphire Palms Society';
    const mockUserId = isSocietyAdmin ? '2ea02706-77b8-4086-bc92-181ffd9a3090' : '2d2af9ac-6cd9-4691-9531-4c6d8a58dfa4';

    const mockUser: User = {
      id: mockUserId,
      app_metadata: {},
      user_metadata: {},
      aud: 'authenticated',
      created_at: new Date().toISOString(),
      email: email.trim(),
    } as User;

    const mockProfile: Profile = {
      id: mockUserId,
      full_name: isSocietyAdmin ? 'Kavita Iyer (Society Admin)' : isStaff ? 'Rajesh Kumar (Technician)' : 'Aarav Sharma (Resident)',
      email: email.trim(),
      preferred_language: 'en',
      is_platform_admin: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const mockSociety: Society = {
      id: mockSocId,
      name: mockSocName,
      registration_number: isSocietyAdmin ? 'MAH/MUM/2026/001' : 'MAH/PUN/2026/002',
      address: isSocietyAdmin ? '12 Linking Road, Bandra West' : '45 Koregaon Park Road',
      city: isSocietyAdmin ? 'Mumbai' : 'Pune',
      state: 'Maharashtra',
      pincode: isSocietyAdmin ? '400050' : '411001',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const mockMembership: SocietyMembership = {
      id: `mem-${mockSocId.slice(0, 8)}`,
      society_id: mockSocId,
      user_id: mockUserId,
      role: role,
      status: 'active',
      staff_designation: isStaff ? 'Lead Electrician & Facility Supervisor' : undefined,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const demoState = {
      user: mockUser,
      profile: mockProfile,
      societies: [mockSociety],
      currentSociety: mockSociety,
      memberships: [mockMembership],
      currentMembership: mockMembership,
    };

    try {
      localStorage.setItem('smartresolve_demo_session', JSON.stringify(demoState));
    } catch (e) {
      console.warn('Could not cache demo session in localStorage', e);
    }

    setUser(mockUser);
    setProfile(mockProfile);
    setSocieties([mockSociety]);
    setCurrentSociety(mockSociety);
    setMemberships([mockMembership]);
    setCurrentMembership(mockMembership);

    return {
      success: true,
      memberships: [mockMembership],
      currentMembership: mockMembership,
    };
  };

  // Initial Session Loading & Listener Setup
  useEffect(() => {
    let isMounted = true;

    // Check cached demo session first
    const storedDemo = localStorage.getItem('smartresolve_demo_session');
    if (storedDemo) {
      try {
        const parsed = JSON.parse(storedDemo);
        if (isMounted) {
          setUser(parsed.user);
          setProfile(parsed.profile);
          setSocieties(parsed.societies);
          setCurrentSociety(parsed.currentSociety);
          setMemberships(parsed.memberships);
          setCurrentMembership(parsed.currentMembership);
          setIsLoading(false);
        }
        return;
      } catch (e) {
        localStorage.removeItem('smartresolve_demo_session');
      }
    }

    if (!isSupabaseConfigured) {
      setIsLoading(false);
      return;
    }

    const initAuth = async () => {
      try {
        const { data: { session: initialSession }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;

        if (isMounted) {
          setSession(initialSession);
          setUser(initialSession?.user ?? null);
          if (initialSession?.user) {
            await fetchUserData(initialSession.user.id);
          }
        }
      } catch (err: any) {
        console.error('Auth initialization error:', err);
        if (isMounted) setError(err.message || 'Failed to initialize session');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    initAuth();

    // Listen to Auth State Changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (!isMounted) return;
      setSession(newSession);
      setUser(newSession?.user ?? null);

      if (newSession?.user) {
        await fetchUserData(newSession.user.id);
      } else {
        setProfile(null);
        setMemberships([]);
        setSocieties([]);
        setCurrentSociety(null);
        setCurrentMembership(null);
      }
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [fetchUserData]);

  // Sign In
  const signIn = async (email: string, password: string) => {
    setError(null);
    const normalizedEmail = email.trim().toLowerCase();

    // 1. Try Supabase Auth if configured
    if (isSupabaseConfigured) {
      try {
        setIsLoading(true);
        const { data, error: authError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (!authError && data.user) {
          localStorage.removeItem('smartresolve_demo_session');
          setUser(data.user);
          setSession(data.session);
          const userContext = await fetchUserData(data.user.id);
          return {
            success: true,
            memberships: userContext?.memberships || [],
            currentMembership: userContext?.currentMembership || null,
          };
        }
      } catch (netErr) {
        console.warn('Live Supabase sign in failed or unreachable, checking demo fallback:', netErr);
      } finally {
        setIsLoading(false);
      }
    }

    // 2. Demo & Test Account Fallback
    if (
      normalizedEmail.includes('admin') ||
      normalizedEmail === 'admin_society_a@smartresolve.local'
    ) {
      return establishDemoSession('society_admin', email);
    } else if (
      normalizedEmail.includes('tech') ||
      normalizedEmail.includes('staff') ||
      normalizedEmail === 'technician@smartresolve.local'
    ) {
      return establishDemoSession('maintenance_staff', email);
    } else if (
      normalizedEmail.includes('resident') ||
      normalizedEmail === 'resident_society_b@smartresolve.local'
    ) {
      return establishDemoSession('resident', email);
    }

    const err = 'Invalid credentials. Please use one of the test accounts or demo buttons.';
    setError(err);
    return { success: false, error: err };
  };

  // Sign Up
  const signUp = async (
    email: string,
    password: string,
    fullName: string,
    preferredLanguage: 'en' | 'hi' | 'mr' = 'en'
  ) => {
    setError(null);
    if (!isSupabaseConfigured) {
      const err = 'Supabase credentials are not configured in .env. Real registration requires VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.';
      setError(err);
      return { success: false, error: err };
    }

    try {
      setIsLoading(true);
      const { data, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            preferred_language: preferredLanguage,
          },
        },
      });

      if (authError) {
        setError(authError.message);
        return { success: false, error: authError.message };
      }

      if (data.user) {
        // Initialize profile in public.profiles table (strictly is_platform_admin = false)
        const { error: profileError } = await supabase.from('profiles').upsert({
          id: data.user.id,
          full_name: fullName.trim(),
          email: email.trim(),
          preferred_language: preferredLanguage,
          is_platform_admin: false,
        });

        if (profileError) {
          console.warn('Profile initialization notice:', profileError.message);
        }

        setUser(data.user);
        setSession(data.session);
        if (data.session) {
          await fetchUserData(data.user.id);
        }
      }

      return { success: true };
    } catch (err: any) {
      const msg = err.message || 'An unexpected error occurred during registration';
      setError(msg);
      return { success: false, error: msg };
    } finally {
      setIsLoading(false);
    }
  };

  // Sign Out
  const signOut = async () => {
    setIsLoading(true);
    try {
      if (isSupabaseConfigured) {
        await supabase.auth.signOut();
      }
    } catch (err) {
      console.error('Sign out error:', err);
    } finally {
      localStorage.removeItem('smartresolve_demo_session');
      setUser(null);
      setSession(null);
      setProfile(null);
      setMemberships([]);
      setSocieties([]);
      setCurrentSociety(null);
      setCurrentMembership(null);
      setIsLoading(false);
    }
  };

  // Password Recovery
  const resetPassword = async (email: string) => {
    setError(null);
    if (!isSupabaseConfigured) {
      const err = 'Supabase credentials are not configured in .env. Password recovery requires live connection.';
      setError(err);
      return { success: false, error: err };
    }

    try {
      const redirectTo = `${window.location.origin}/auth/reset-password`;
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo,
      });

      if (resetErr) {
        setError(resetErr.message);
        return { success: false, error: resetErr.message };
      }

      return { success: true };
    } catch (err: any) {
      const msg = err.message || 'Failed to initiate password reset';
      setError(msg);
      return { success: false, error: msg };
    }
  };

  // Set New Password
  const updatePassword = async (newPassword: string) => {
    setError(null);
    if (!isSupabaseConfigured) {
      const err = 'Supabase credentials are not configured.';
      return { success: false, error: err };
    }

    try {
      const { error: updateErr } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateErr) {
        setError(updateErr.message);
        return { success: false, error: updateErr.message };
      }

      return { success: true };
    } catch (err: any) {
      const msg = err.message || 'Failed to update password';
      setError(msg);
      return { success: false, error: msg };
    }
  };

  // Multi-society Context Switching
  const selectSociety = (societyId: string) => {
    const soc = societies.find((s) => s.id === societyId);
    const mem = memberships.find((m) => m.society_id === societyId);
    if (soc && mem) {
      setCurrentSociety(soc);
      setCurrentMembership(mem);
    }
  };

  // Request Membership as a Resident (Starts with status = 'pending')
  const requestSocietyMembership = async (societyId: string, flatNumberOrId?: string | null) => {
    if (!user) return { success: false, error: 'User must be authenticated' };
    if (!isSupabaseConfigured) return { success: false, error: 'Database connection unconfigured' };

    try {
      // 1. Check if user already has a membership record in this society
      const { data: existing, error: checkError } = await supabase
        .from('society_memberships')
        .select('*')
        .eq('society_id', societyId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (checkError) {
        console.warn('Membership pre-check query notice:', checkError.message);
      }

      if (existing) {
        await fetchUserData(user.id);
        const existingMem = existing as SocietyMembership;

        if (existingMem.status === 'active') {
          const roleLabel =
            existingMem.role === 'society_admin'
              ? 'Administrator'
              : existingMem.role === 'maintenance_staff'
              ? 'Maintenance Staff'
              : existingMem.role === 'supervisor'
              ? 'Supervisor'
              : 'Resident';

          return {
            success: false,
            code: 'ALREADY_ACTIVE' as const,
            error: `You are already an approved member (${roleLabel}) of this housing society.`,
            existingMembership: existingMem,
          };
        }

        if (existingMem.status === 'pending') {
          return {
            success: false,
            code: 'ALREADY_PENDING' as const,
            error: 'Your membership application is already awaiting administrator approval.',
            existingMembership: existingMem,
          };
        }

        if (existingMem.status === 'rejected' || existingMem.status === 'suspended') {
          return {
            success: false,
            code: 'MEMBERSHIP_INACTIVE' as const,
            error: `Your membership in this society was ${existingMem.status}. Please contact the Society Management Committee.`,
            existingMembership: existingMem,
          };
        }
      }

      // 2. Resolve flat_id if a flat number or UUID was provided
      let resolvedFlatId: string | null = null;
      if (flatNumberOrId && flatNumberOrId.trim()) {
        const inputVal = flatNumberOrId.trim();
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(inputVal);
        if (isUuid) {
          resolvedFlatId = inputVal;
        } else {
          const { data: flatMatch } = await supabase
            .from('flats')
            .select('id')
            .eq('society_id', societyId)
            .ilike('flat_number', inputVal)
            .maybeSingle();

          if (flatMatch) {
            resolvedFlatId = flatMatch.id;
          }
        }
      }

      // 3. Insert fresh pending residency application
      const { error: insertError } = await supabase
        .from('society_memberships')
        .insert({
          society_id: societyId,
          user_id: user.id,
          flat_id: resolvedFlatId,
          role: 'resident',
          status: 'pending',
        });

      if (insertError) {
        // Handle concurrent duplicate submission gracefully
        if (
          insertError.code === '23505' ||
          insertError.message.includes('uq_society_membership') ||
          insertError.message.includes('duplicate key')
        ) {
          await fetchUserData(user.id);
          return {
            success: false,
            code: 'DUPLICATE_MEMBERSHIP' as const,
            error: 'You have already submitted an application for this society.',
          };
        }

        // Safe developer diagnostic (no secret exposure)
        console.error('Membership insert failed safely:', insertError.code, insertError.message);
        return {
          success: false,
          code: 'SERVER_ERROR' as const,
          error: 'We could not submit your application. Please check your details and try again.',
        };
      }

      await fetchUserData(user.id);
      return { success: true };
    } catch (err: any) {
      console.error('Membership request exception:', err);
      return {
        success: false,
        code: 'SERVER_ERROR' as const,
        error: 'An unexpected error occurred while submitting your application. Please try again.',
      };
    }
  };

  // Society Admin: Approve Pending Resident
  const approveMembership = async (membershipId: string) => {
    if (!user || !currentMembership || currentMembership.role !== 'society_admin') {
      return { success: false, error: 'Unauthorized: Society administrator role required' };
    }

    try {
      const { error: updateError } = await supabase
        .from('society_memberships')
        .update({
          status: 'active',
          approved_by: user.id,
          approved_at: new Date().toISOString(),
        })
        .eq('id', membershipId);

      if (updateError) {
        return { success: false, error: updateError.message };
      }

      await fetchUserData(user.id);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to approve membership' };
    }
  };

  // Society Admin: Reject Pending Resident
  const rejectMembership = async (membershipId: string) => {
    if (!user || !currentMembership || currentMembership.role !== 'society_admin') {
      return { success: false, error: 'Unauthorized: Society administrator role required' };
    }

    try {
      const { error: updateError } = await supabase
        .from('society_memberships')
        .update({
          status: 'rejected',
          approved_by: user.id,
          approved_at: new Date().toISOString(),
        })
        .eq('id', membershipId);

      if (updateError) {
        return { success: false, error: updateError.message };
      }

      await fetchUserData(user.id);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to reject membership' };
    }
  };

  // Society Admin: Enroll In-House Maintenance Staff / Supervisor
  const enrollStaffMember = async (
    societyId: string,
    targetUserId: string,
    role: 'maintenance_staff' | 'supervisor',
    designation: string
  ) => {
    if (!user || !currentMembership || currentMembership.role !== 'society_admin') {
      return { success: false, error: 'Unauthorized: Society administrator role required' };
    }

    try {
      const { error: insertError } = await supabase
        .from('society_memberships')
        .insert({
          society_id: societyId,
          user_id: targetUserId,
          role,
          status: 'active',
          staff_designation: designation,
          approved_by: user.id,
          approved_at: new Date().toISOString(),
        });

      if (insertError) {
        return { success: false, error: insertError.message };
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to enroll staff member' };
    }
  };

  const refreshData = async () => {
    if (user) {
      await fetchUserData(user.id);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        memberships,
        societies,
        currentSociety,
        currentMembership,
        isLoading,
        isConfigured: isSupabaseConfigured,
        error,
        clearError,
        signIn,
        signUp,
        signOut,
        resetPassword,
        updatePassword,
        selectSociety,
        requestSocietyMembership,
        approveMembership,
        rejectMembership,
        enrollStaffMember,
        refreshData,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
