// ==============================================================================
// SmartResolve Notification Bell & Dropdown Component
// Real in-app notifications with unread badge, recipient isolation, and read status
// ==============================================================================

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../ui/Icon';
import { useAuth } from '../../context/AuthContext';
import {
  fetchUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from '../../lib/notificationService';
import type { NotificationItem } from '../../types/database';

export const NotificationBell: React.FC = () => {
  const { user, currentSociety } = useAuth();
  const navigate = useNavigate();

  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const loadNotifications = async () => {
    if (!user || !currentSociety) return;
    setIsLoading(true);
    try {
      const items = await fetchUserNotifications(user.id, currentSociety.id);
      setNotifications(items);
    } catch (err) {
      console.warn('Failed to fetch notifications:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 30000); // 30s background poll
    return () => clearInterval(interval);
  }, [user?.id, currentSociety?.id]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const handleItemClick = async (notif: NotificationItem) => {
    if (!notif.is_read) {
      await markNotificationAsRead(notif.id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n))
      );
    }
    setIsOpen(false);
    if (notif.complaint_id) {
      navigate(`/track?id=${notif.complaint_id}`);
    }
  };

  const handleMarkAllRead = async () => {
    if (!user) return;
    await markAllNotificationsAsRead(user.id);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'escalated':
        return <Icon n="alert" s={14} c="text-red-500 shrink-0" />;
      case 'resolved':
        return <Icon n="check" s={14} c="text-teal shrink-0" />;
      case 'assigned':
        return <Icon n="user-check" s={14} c="text-brand shrink-0" />;
      case 'status_changed':
        return <Icon n="clock" s={14} c="text-amber-500 shrink-0" />;
      case 'complaint_submitted':
        return <Icon n="file" s={14} c="text-brand shrink-0" />;
      default:
        return <Icon n="bell" s={14} c="text-muted-foreground shrink-0" />;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) loadNotifications();
        }}
        className="relative rounded-lg border border-bd bg-card p-2 text-muted-foreground hover:text-navy hover:border-teal transition focus:outline-none"
        title="Notifications"
        aria-label="Notifications"
      >
        <Icon n="bell" s={16} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow-sm animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl border border-bd bg-card/95 backdrop-blur-md shadow-xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-bd/60 px-4 py-3 bg-soft/50">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-navy">
                Notifications
              </span>
              {unreadCount > 0 && (
                <span className="rounded-full bg-teal/15 px-2 py-0.5 text-[10px] font-bold text-teal">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-[11px] font-semibold text-teal hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-bd/40">
            {isLoading && notifications.length === 0 ? (
              <div className="p-4 text-center text-xs text-muted-foreground">
                Loading notifications...
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground">
                <Icon n="bell" s={20} c="mx-auto mb-1.5 text-muted-foreground/40" />
                No notifications yet
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => handleItemClick(notif)}
                  className={`flex items-start gap-3 p-3.5 text-xs transition cursor-pointer hover:bg-soft/70 ${
                    !notif.is_read ? 'bg-teal/5 font-medium' : 'text-muted-foreground'
                  }`}
                >
                  <div className="mt-0.5">{getNotificationIcon(notif.notification_type)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <span className="font-semibold text-navy truncate">{notif.title}</span>
                      <span className="text-[10px] text-muted-foreground/70 shrink-0">
                        {new Date(notif.created_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-muted-foreground line-clamp-2">
                      {notif.message}
                    </p>
                  </div>
                  {!notif.is_read && (
                    <span className="h-2 w-2 rounded-full bg-teal shrink-0 mt-1.5" />
                  )}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-bd/60 px-4 py-2 bg-soft/30 text-center text-[10px] text-muted-foreground">
            Scoped to {currentSociety?.name || 'Active Society'}
          </div>
        </div>
      )}
    </div>
  );
};
