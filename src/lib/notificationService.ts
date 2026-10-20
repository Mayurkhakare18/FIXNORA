// ==============================================================================
// SmartResolve Notification Service
// Society-scoped, recipient-isolated in-app notification delivery
// ==============================================================================

import { supabase, isSupabaseConfigured } from './supabase';
import type { NotificationItem } from '../types/database';

export interface CreateNotificationInput {
  societyId: string;
  recipientId: string;
  title: string;
  message: string;
  notificationType: NotificationItem['notification_type'];
  complaintId?: string | null;
  channel?: 'in_app' | 'email' | 'sms';
}

/**
 * Fetch notifications for an authenticated user, ordered newest first
 */
export async function fetchUserNotifications(
  userId: string,
  societyId?: string
): Promise<NotificationItem[]> {
  if (!isSupabaseConfigured || !userId) return [];

  let query = supabase
    .from('notifications')
    .select('*')
    .eq('recipient_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (societyId) {
    query = query.eq('society_id', societyId);
  }

  const { data, error } = await query;
  if (error) {
    console.warn('Failed to fetch user notifications:', error.message);
    return [];
  }

  return (data || []) as NotificationItem[];
}

/**
 * Mark a single notification as read
 */
export async function markNotificationAsRead(notificationId: string): Promise<void> {
  if (!isSupabaseConfigured || !notificationId) return;

  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId);

  if (error) {
    console.warn('Failed to mark notification read:', error.message);
  }
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllNotificationsAsRead(userId: string): Promise<void> {
  if (!isSupabaseConfigured || !userId) return;

  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('recipient_id', userId)
    .eq('is_read', false);

  if (error) {
    console.warn('Failed to mark all notifications read:', error.message);
  }
}

/**
 * Dispatch a genuine in-app notification to a user.
 * Delivery state is recorded immediately for genuine in-app channels.
 */
export async function createNotification(
  input: CreateNotificationInput
): Promise<NotificationItem | null> {
  if (!isSupabaseConfigured) return null;

  const payload = {
    society_id: input.societyId,
    recipient_id: input.recipientId,
    complaint_id: input.complaintId || null,
    title: input.title.trim(),
    message: input.message.trim(),
    notification_type: input.notificationType,
    channel: input.channel || 'in_app',
    is_read: false,
    delivered_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('notifications')
    .insert([payload])
    .select('*')
    .single();

  if (error) {
    console.warn('Failed to dispatch notification:', error.message);
    return null;
  }

  return data as NotificationItem;
}

/**
 * Dispatch notifications to all society admins and supervisors
 */
export async function notifySocietySupervisorsAndAdmins(params: {
  societyId: string;
  title: string;
  message: string;
  notificationType: NotificationItem['notification_type'];
  complaintId?: string | null;
}): Promise<number> {
  if (!isSupabaseConfigured) return 0;

  // Find active admins and supervisors in the society
  const { data: members, error } = await supabase
    .from('society_memberships')
    .select('user_id')
    .eq('society_id', params.societyId)
    .eq('status', 'active')
    .in('role', ['society_admin', 'supervisor']);

  if (error || !members || members.length === 0) return 0;

  let dispatched = 0;
  for (const m of members) {
    const res = await createNotification({
      societyId: params.societyId,
      recipientId: m.user_id,
      title: params.title,
      message: params.message,
      notificationType: params.notificationType,
      complaintId: params.complaintId,
    });
    if (res) dispatched++;
  }

  return dispatched;
}
