// ==============================================================================
// SmartResolve Admin: Society Announcements Management
// ==============================================================================

import React, { useState, useEffect } from 'react';
import { Card, Btn, Pill } from '../../../components/ui/Primitives';
import { Icon } from '../../../components/ui/Icon';
import {
  fetchSocietyAnnouncements,
  createAnnouncement,
  deleteAnnouncement,
  type AnnouncementWithAuthor,
} from '../../../lib/communityService';

interface AnnouncementsSectionProps {
  societyId: string;
  authorId: string;
}

export const AnnouncementsSection: React.FC<AnnouncementsSectionProps> = ({
  societyId,
  authorId,
}) => {
  const [announcements, setAnnouncements] = useState<AnnouncementWithAuthor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<'general' | 'maintenance' | 'emergency' | 'event' | 'billing'>('general');
  const [isPinned, setIsPinned] = useState(false);
  const [expiresAt, setExpiresAt] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const loadAnnouncements = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: fetchErr } = await fetchSocietyAnnouncements(societyId);
      if (fetchErr) setError(fetchErr);
      else setAnnouncements(data || []);
    } catch (e: any) {
      setError(e.message || 'Failed to load announcements');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAnnouncements();
  }, [societyId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setModalError(null);

    try {
      const res = await createAnnouncement(societyId, authorId, {
        title,
        content,
        category,
        is_pinned: isPinned,
        expires_at: expiresAt || null,
      });

      if (res.error) {
        setModalError(res.error);
      } else {
        setToast('Announcement published successfully to society feed!');
        setShowModal(false);
        setTitle('');
        setContent('');
        setCategory('general');
        setIsPinned(false);
        setExpiresAt('');
        await loadAnnouncements();
      }
    } catch (err: any) {
      setModalError(err.message || 'Failed to create announcement');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this announcement?')) return;
    try {
      const res = await deleteAnnouncement(id);
      if (res.success) {
        setToast('Announcement removed.');
        await loadAnnouncements();
      } else {
        setError(res.error || 'Failed to delete announcement');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to delete announcement');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-navy">Society Broadcasts & Circulars</h2>
          <p className="text-xs text-muted-foreground">
            Publish official announcements, emergency alerts, maintenance circulars, and notices.
          </p>
        </div>

        <Btn v="p" onClick={() => setShowModal(true)} className="py-2 text-xs">
          <Icon n="plus" s={14} />
          <span>New Announcement</span>
        </Btn>
      </div>

      {toast && (
        <div className="rounded-xl border border-teal/30 bg-teal/10 p-3 text-xs text-teal font-medium flex items-center justify-between">
          <span>{toast}</span>
          <button type="button" onClick={() => setToast(null)} className="font-bold">✕</button>
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-xs text-red-700 border border-red-200">
          {error}
        </div>
      )}

      {isLoading && (
        <div className="space-y-3">
          {[1, 2].map((n) => (
            <div key={n} className="rounded-xl border border-bd bg-card p-5 animate-pulse space-y-2">
              <div className="h-4 bg-soft rounded w-1/4" />
              <div className="h-5 bg-soft rounded w-3/4" />
              <div className="h-10 bg-soft rounded w-full" />
            </div>
          ))}
        </div>
      )}

      {!isLoading && announcements.length === 0 && (
        <Card className="p-8 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-soft text-navy/40">
            <Icon n="bell" s={22} />
          </div>
          <h4 className="mt-2 text-sm font-bold text-navy">No announcements published</h4>
          <p className="mt-1 text-xs text-muted-foreground">
            Create an announcement to broadcast notices and alerts to all society residents.
          </p>
        </Card>
      )}

      {!isLoading && announcements.length > 0 && (
        <div className="space-y-3">
          {announcements.map((ann) => (
            <Card
              key={ann.id}
              className={`p-4 transition space-y-2 ${
                ann.is_pinned ? 'border-amber-400 bg-amber-50/20' : ''
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {ann.is_pinned && (
                    <span className="rounded bg-amber-100 text-amber-900 text-[10px] font-bold px-2 py-0.5 border border-amber-300">
                      PINNED
                    </span>
                  )}
                  <Pill tone={ann.category === 'emergency' ? 'h' : ann.category === 'maintenance' ? 'n' : 't'}>
                    {ann.category.toUpperCase()}
                  </Pill>
                  <span className="text-xs text-muted-foreground">
                    By <strong className="text-navy">{ann.author_name}</strong> • {new Date(ann.published_at).toLocaleDateString()}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => handleDelete(ann.id)}
                  className="text-xs text-red-600 hover:text-red-800 font-semibold"
                >
                  Delete
                </button>
              </div>

              <h4 className="text-base font-bold text-navy">{ann.title}</h4>
              <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">
                {ann.content}
              </p>

              {ann.expires_at && (
                <div className="text-[11px] text-muted-foreground pt-1">
                  Expires on: <strong>{new Date(ann.expires_at).toLocaleDateString()}</strong>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Modal: New Announcement */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <Card className="w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-bd/60 pb-3">
              <div>
                <h3 className="text-base font-bold text-navy">Publish Society Announcement</h3>
                <p className="text-xs text-muted-foreground">Broadcast official circulars to all residents</p>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-muted-foreground hover:text-navy"
              >
                ✕
              </button>
            </div>

            {modalError && (
              <div className="rounded-lg bg-red-50 p-2.5 text-xs text-red-700 border border-red-200">
                {modalError}
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-navy mb-1">
                  Announcement Title *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Annual Water Tank Cleaning Schedule"
                  className="w-full rounded-lg border border-bd bg-card px-3 py-2 text-xs text-navy focus:border-teal focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-navy mb-1">
                    Category *
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    className="w-full rounded-lg border border-bd bg-card px-3 py-2 text-xs text-navy focus:border-teal focus:outline-none"
                  >
                    <option value="general">General Circular</option>
                    <option value="maintenance">Maintenance Notice</option>
                    <option value="emergency">Emergency Alert</option>
                    <option value="event">Society Event</option>
                    <option value="billing">Billing & Dues</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-navy mb-1">
                    Expiration Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                    className="w-full rounded-lg border border-bd bg-card px-3 py-2 text-xs text-navy focus:border-teal focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-navy mb-1">
                  Content / Notice Details *
                </label>
                <textarea
                  rows={4}
                  required
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Type full announcement message here..."
                  className="w-full rounded-lg border border-bd bg-card p-3 text-xs text-navy focus:border-teal focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="pinNotice"
                  checked={isPinned}
                  onChange={(e) => setIsPinned(e.target.checked)}
                  className="text-teal focus:ring-teal rounded"
                />
                <label htmlFor="pinNotice" className="text-xs font-medium text-navy cursor-pointer">
                  Pin this announcement to top of resident feed
                </label>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-bd/60">
                <Btn type="button" onClick={() => setShowModal(false)} className="py-2 text-xs">
                  Cancel
                </Btn>
                <Btn type="submit" v="p" disabled={isSubmitting} className="py-2 text-xs">
                  {isSubmitting ? 'Publishing...' : 'Publish Announcement'}
                </Btn>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
};
