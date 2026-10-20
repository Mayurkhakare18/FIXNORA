// ==============================================================================
// SmartResolve Community Service
// Society Announcements, Multi-Unit Polls & Voting, Emergency Contacts
// Scoped strictly to authorized housing society membership
// ==============================================================================

import { supabase, isSupabaseConfigured } from './supabase';
import { createNotification } from './notificationService';
import type { Announcement, Poll, PollOption, EmergencyContact } from '../types/database';

export interface PollWithOptions extends Poll {
  options: (PollOption & { vote_count: number })[];
  total_votes: number;
  has_voted: boolean;
  user_voted_option_id?: string | null;
  creator_name?: string;
}

export interface AnnouncementWithAuthor extends Announcement {
  author_name?: string;
}

// ------------------------------------------------------------------------------
// Society Announcements
// ------------------------------------------------------------------------------

/**
 * Fetch announcements for a given society
 */
export async function fetchSocietyAnnouncements(
  societyId: string,
  category?: 'general' | 'maintenance' | 'emergency' | 'event' | 'billing'
): Promise<{ data: AnnouncementWithAuthor[] | null; error: string | null }> {
  if (!isSupabaseConfigured) {
    return { data: [], error: null };
  }

  try {
    let query = supabase
      .from('announcements')
      .select(`
        *,
        author:profiles!announcements_author_id_fkey(full_name)
      `)
      .eq('society_id', societyId)
      .order('is_pinned', { ascending: false })
      .order('published_at', { ascending: false });

    if (category) {
      query = query.eq('category', category);
    }

    const { data, error } = await query;

    if (error) {
      return { data: null, error: error.message };
    }

    const formatted: AnnouncementWithAuthor[] = (data || []).map((item: any) => ({
      ...item,
      author_name: item.author?.full_name || 'Society Office',
    }));

    return { data: formatted, error: null };
  } catch (err: any) {
    return { data: null, error: err.message || 'Failed to fetch announcements' };
  }
}

/**
 * Create a new society announcement
 */
export async function createAnnouncement(
  societyId: string,
  authorId: string,
  payload: {
    title: string;
    content: string;
    category: 'general' | 'maintenance' | 'emergency' | 'event' | 'billing';
    is_pinned?: boolean;
    expires_at?: string | null;
  }
): Promise<{ data: Announcement | null; error: string | null }> {
  if (!payload.title || payload.title.trim().length < 3) {
    return { data: null, error: 'Title must be at least 3 characters' };
  }
  if (!payload.content || payload.content.trim().length < 10) {
    return { data: null, error: 'Announcement content must be at least 10 characters' };
  }

  if (!isSupabaseConfigured) {
    return {
      data: {
        id: 'mock-announcement-' + Date.now(),
        society_id: societyId,
        author_id: authorId,
        title: payload.title.trim(),
        content: payload.content.trim(),
        category: payload.category,
        is_pinned: Boolean(payload.is_pinned),
        published_at: new Date().toISOString(),
        expires_at: payload.expires_at || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      error: null,
    };
  }

  try {
    const { data, error } = await supabase
      .from('announcements')
      .insert({
        society_id: societyId,
        author_id: authorId,
        title: payload.title.trim(),
        content: payload.content.trim(),
        category: payload.category,
        is_pinned: Boolean(payload.is_pinned),
        expires_at: payload.expires_at || null,
        published_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      return { data: null, error: error.message };
    }

    // If emergency announcement, broadcast notification
    if (payload.category === 'emergency') {
      try {
        await createNotification({
          societyId,
          recipientId: authorId,
          title: `Emergency Notice: ${payload.title}`,
          message: payload.content.substring(0, 160),
          notificationType: 'emergency_alert',
        });
      } catch {
        // notification broadcast is non-blocking
      }
    }

    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message || 'Failed to create announcement' };
  }
}

/**
 * Delete announcement (Admin / Supervisor only)
 */
export async function deleteAnnouncement(
  announcementId: string
): Promise<{ success: boolean; error: string | null }> {
  if (!isSupabaseConfigured) {
    return { success: true, error: null };
  }

  try {
    const { error } = await supabase
      .from('announcements')
      .delete()
      .eq('id', announcementId);

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to delete announcement' };
  }
}

// ------------------------------------------------------------------------------
// Community Polls & Voting
// ------------------------------------------------------------------------------

/**
 * Fetch all polls for a society, with calculated vote tallies and member voting status
 */
export async function fetchSocietyPolls(
  societyId: string,
  currentUserId?: string,
  userFlatId?: string | null
): Promise<{ data: PollWithOptions[] | null; error: string | null }> {
  if (!isSupabaseConfigured) {
    return { data: [], error: null };
  }

  try {
    // 1. Fetch polls with creator profile
    const { data: pollsData, error: pollsError } = await supabase
      .from('polls')
      .select(`
        *,
        creator:profiles!polls_created_by_fkey(full_name),
        options:poll_options(*)
      `)
      .eq('society_id', societyId)
      .order('is_active', { ascending: false })
      .order('closing_date', { ascending: false });

    if (pollsError) {
      return { data: null, error: pollsError.message };
    }

    if (!pollsData || pollsData.length === 0) {
      return { data: [], error: null };
    }

    const pollIds = pollsData.map((p) => p.id);

    // 2. Fetch all votes for these polls
    const { data: votesData, error: votesError } = await supabase
      .from('poll_votes')
      .select('poll_id, option_id, user_id, flat_id')
      .in('poll_id', pollIds);

    if (votesError) {
      return { data: null, error: votesError.message };
    }

    const allVotes = votesData || [];

    // 3. Assemble PollWithOptions
    const formattedPolls: PollWithOptions[] = pollsData.map((poll: any) => {
      const pollVotes = allVotes.filter((v) => v.poll_id === poll.id);
      const totalVotes = pollVotes.length;

      // Determine if current user or flat has voted
      let hasVoted = false;
      let userVotedOptionId: string | null = null;

      if (currentUserId) {
        const userVote = pollVotes.find((v) => v.user_id === currentUserId);
        if (userVote) {
          hasVoted = true;
          userVotedOptionId = userVote.option_id;
        } else if (poll.voting_unit === 'per_flat' && userFlatId) {
          const flatVote = pollVotes.find((v) => v.flat_id === userFlatId);
          if (flatVote) {
            hasVoted = true;
            userVotedOptionId = flatVote.option_id;
          }
        }
      }

      // Map options with vote counts
      const rawOptions = (poll.options || []).sort(
        (a: any, b: any) => (a.display_order ?? 0) - (b.display_order ?? 0)
      );

      const optionsWithCounts = rawOptions.map((opt: any) => {
        const count = pollVotes.filter((v) => v.option_id === opt.id).length;
        return {
          ...opt,
          vote_count: count,
        };
      });

      return {
        id: poll.id,
        society_id: poll.society_id,
        created_by: poll.created_by,
        question: poll.question,
        description: poll.description,
        closing_date: poll.closing_date,
        voting_unit: poll.voting_unit,
        is_active: poll.is_active,
        created_at: poll.created_at,
        updated_at: poll.updated_at,
        options: optionsWithCounts,
        total_votes: totalVotes,
        has_voted: hasVoted,
        user_voted_option_id: userVotedOptionId,
        creator_name: poll.creator?.full_name || 'Society Administration',
      };
    });

    return { data: formattedPolls, error: null };
  } catch (err: any) {
    return { data: null, error: err.message || 'Failed to fetch community polls' };
  }
}

/**
 * Create a new poll with voting options
 */
export async function createPoll(
  societyId: string,
  createdBy: string,
  payload: {
    question: string;
    description?: string;
    closing_date: string;
    voting_unit: 'per_flat' | 'per_resident';
    options: string[];
  }
): Promise<{ data: Poll | null; error: string | null }> {
  if (!payload.question || payload.question.trim().length < 5) {
    return { data: null, error: 'Poll question must be at least 5 characters' };
  }
  if (!payload.options || payload.options.length < 2) {
    return { data: null, error: 'A poll must have at least two voting options' };
  }
  const cleanOptions = payload.options.map((o) => o.trim()).filter((o) => o.length > 0);
  if (cleanOptions.length < 2) {
    return { data: null, error: 'All voting options must be non-empty' };
  }

  const closingDate = new Date(payload.closing_date);
  if (isNaN(closingDate.getTime()) || closingDate <= new Date()) {
    return { data: null, error: 'Closing date must be in the future' };
  }

  if (!isSupabaseConfigured) {
    return {
      data: {
        id: 'mock-poll-' + Date.now(),
        society_id: societyId,
        created_by: createdBy,
        question: payload.question.trim(),
        description: payload.description || null,
        closing_date: payload.closing_date,
        voting_unit: payload.voting_unit,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      error: null,
    };
  }

  try {
    // 1. Insert poll
    const { data: poll, error: pollError } = await supabase
      .from('polls')
      .insert({
        society_id: societyId,
        created_by: createdBy,
        question: payload.question.trim(),
        description: payload.description?.trim() || null,
        closing_date: payload.closing_date,
        voting_unit: payload.voting_unit,
        is_active: true,
      })
      .select()
      .single();

    if (pollError || !poll) {
      return { data: null, error: pollError?.message || 'Failed to create poll' };
    }

    // 2. Insert poll options
    const optionRows = cleanOptions.map((opt, idx) => ({
      poll_id: poll.id,
      option_text: opt,
      display_order: idx + 1,
    }));

    const { error: optError } = await supabase.from('poll_options').insert(optionRows);
    if (optError) {
      return { data: null, error: optError.message };
    }

    return { data: poll, error: null };
  } catch (err: any) {
    return { data: null, error: err.message || 'Failed to create community poll' };
  }
}

/**
 * Cast a vote on a poll
 */
export async function castPollVote(
  pollId: string,
  optionId: string,
  userId: string,
  flatId?: string | null
): Promise<{ success: boolean; error: string | null }> {
  if (!pollId || !optionId || !userId) {
    return { success: false, error: 'Missing required voting parameters' };
  }

  if (!isSupabaseConfigured) {
    return { success: true, error: null };
  }

  try {
    // Check poll status first
    const { data: poll, error: pollError } = await supabase
      .from('polls')
      .select('is_active, closing_date, voting_unit')
      .eq('id', pollId)
      .single();

    if (pollError || !poll) {
      return { success: false, error: 'Target poll not found' };
    }

    if (!poll.is_active) {
      return { success: false, error: 'Voting closed: This poll is no longer active' };
    }

    if (new Date(poll.closing_date) <= new Date()) {
      return { success: false, error: 'Voting closed: Deadline has expired' };
    }

    if (poll.voting_unit === 'per_flat' && !flatId) {
      return {
        success: false,
        error: 'Per-flat voting requires an assigned flat on your profile',
      };
    }

    // Insert vote (enforced by DB trigger trg_check_poll_vote_rules & uq_poll_user_vote)
    const { error: insertError } = await supabase.from('poll_votes').insert({
      poll_id: pollId,
      option_id: optionId,
      user_id: userId,
      flat_id: flatId || null,
      voted_at: new Date().toISOString(),
    });

    if (insertError) {
      if (insertError.code === '23505' || insertError.message.includes('already been cast')) {
        return {
          success: false,
          error:
            poll.voting_unit === 'per_flat'
              ? 'A vote has already been cast for this flat'
              : 'You have already voted in this poll',
        };
      }
      return { success: false, error: insertError.message };
    }

    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to cast vote' };
  }
}

/**
 * Close a poll manually (Admin only)
 */
export async function closePoll(
  pollId: string
): Promise<{ success: boolean; error: string | null }> {
  if (!isSupabaseConfigured) {
    return { success: true, error: null };
  }

  try {
    const { error } = await supabase
      .from('polls')
      .update({ is_active: false })
      .eq('id', pollId);

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to close poll' };
  }
}

// ------------------------------------------------------------------------------
// Emergency Contacts
// ------------------------------------------------------------------------------

/**
 * Validate phone number format (Supports 10-digit mobile, 11-digit landline, or 3-digit emergency codes)
 */
export function validatePhoneNumber(phone: string): boolean {
  if (!phone) return false;
  const cleaned = phone.replace(/[\s\-\(\)\+]/g, '');
  // Matches emergency 3-4 digit numbers (100, 101, 102, 108, 112) or 10-12 digit standard numbers
  return /^[0-9]{3,4}$/.test(cleaned) || /^[0-9]{10,12}$/.test(cleaned);
}

/**
 * Fetch society emergency contacts ordered by display_order
 */
export async function fetchSocietyEmergencyContacts(
  societyId: string
): Promise<{ data: EmergencyContact[] | null; error: string | null }> {
  if (!isSupabaseConfigured) {
    return { data: [], error: null };
  }

  try {
    const { data, error } = await supabase
      .from('emergency_contacts')
      .select('*')
      .eq('society_id', societyId)
      .order('display_order', { ascending: true })
      .order('title', { ascending: true });

    if (error) {
      return { data: null, error: error.message };
    }
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message || 'Failed to fetch emergency contacts' };
  }
}

/**
 * Create emergency contact (Admin / Supervisor only)
 */
export async function createEmergencyContact(
  societyId: string,
  payload: {
    title: string;
    contact_person?: string;
    phone_number: string;
    alternative_phone?: string;
    available_hours?: string;
    display_order?: number;
  }
): Promise<{ data: EmergencyContact | null; error: string | null }> {
  if (!payload.title || payload.title.trim().length < 2) {
    return { data: null, error: 'Contact title is required (e.g. Main Gate Security)' };
  }

  if (!validatePhoneNumber(payload.phone_number)) {
    return { data: null, error: 'Please enter a valid phone number or emergency code' };
  }

  if (payload.alternative_phone && !validatePhoneNumber(payload.alternative_phone)) {
    return { data: null, error: 'Alternative phone number is invalid' };
  }

  if (!isSupabaseConfigured) {
    return {
      data: {
        id: 'mock-contact-' + Date.now(),
        society_id: societyId,
        title: payload.title.trim(),
        contact_person: payload.contact_person?.trim() || null,
        phone_number: payload.phone_number.trim(),
        alternative_phone: payload.alternative_phone?.trim() || null,
        available_hours: payload.available_hours || '24/7',
        display_order: payload.display_order ?? 0,
        created_at: new Date().toISOString(),
      },
      error: null,
    };
  }

  try {
    const { data, error } = await supabase
      .from('emergency_contacts')
      .insert({
        society_id: societyId,
        title: payload.title.trim(),
        contact_person: payload.contact_person?.trim() || null,
        phone_number: payload.phone_number.trim(),
        alternative_phone: payload.alternative_phone?.trim() || null,
        available_hours: payload.available_hours || '24/7',
        display_order: payload.display_order ?? 0,
      })
      .select()
      .single();

    if (error) {
      return { data: null, error: error.message };
    }
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message || 'Failed to create emergency contact' };
  }
}

/**
 * Delete emergency contact
 */
export async function deleteEmergencyContact(
  contactId: string
): Promise<{ success: boolean; error: string | null }> {
  if (!isSupabaseConfigured) {
    return { success: true, error: null };
  }

  try {
    const { error } = await supabase
      .from('emergency_contacts')
      .delete()
      .eq('id', contactId);

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to delete emergency contact' };
  }
}
