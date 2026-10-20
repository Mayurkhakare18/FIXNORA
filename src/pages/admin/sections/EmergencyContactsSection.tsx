// ==============================================================================
// SmartResolve Admin: Emergency Contacts Management
// ==============================================================================

import React, { useState, useEffect } from 'react';
import { Card, Btn } from '../../../components/ui/Primitives';
import { Icon } from '../../../components/ui/Icon';
import {
  fetchSocietyEmergencyContacts,
  createEmergencyContact,
  deleteEmergencyContact,
} from '../../../lib/communityService';
import type { EmergencyContact } from '../../../types/database';

interface EmergencyContactsSectionProps {
  societyId: string;
}

export const EmergencyContactsSection: React.FC<EmergencyContactsSectionProps> = ({
  societyId,
}) => {
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [altPhone, setAltPhone] = useState('');
  const [hours, setHours] = useState('24/7');
  const [displayOrder, setDisplayOrder] = useState('1');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const loadContacts = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: fetchErr } = await fetchSocietyEmergencyContacts(societyId);
      if (fetchErr) setError(fetchErr);
      else setContacts(data || []);
    } catch (e: any) {
      setError(e.message || 'Failed to load emergency contacts');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadContacts();
  }, [societyId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setModalError(null);

    try {
      const res = await createEmergencyContact(societyId, {
        title,
        contact_person: contactPerson || undefined,
        phone_number: phone,
        alternative_phone: altPhone || undefined,
        available_hours: hours,
        display_order: parseInt(displayOrder, 10) || 0,
      });

      if (res.error) {
        setModalError(res.error);
      } else {
        setToast('Emergency contact added.');
        setShowModal(false);
        setTitle('');
        setContactPerson('');
        setPhone('');
        setAltPhone('');
        setHours('24/7');
        setDisplayOrder('1');
        await loadContacts();
      }
    } catch (err: any) {
      setModalError(err.message || 'Failed to add contact');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (contactId: string) => {
    if (!confirm('Remove this emergency contact?')) return;
    try {
      const res = await deleteEmergencyContact(contactId);
      if (res.success) {
        setToast('Contact removed.');
        await loadContacts();
      } else {
        setError(res.error || 'Failed to remove contact');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to remove contact');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-navy">Emergency & Maintenance Contacts</h2>
          <p className="text-xs text-muted-foreground">
            Manage verified telephone numbers for gate security, fire, medical, lift, and repair staff.
          </p>
        </div>

        <Btn v="p" onClick={() => setShowModal(true)} className="py-2 text-xs">
          <Icon n="plus" s={14} />
          <span>Add Contact</span>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {[1, 2, 3].map((n) => (
            <div key={n} className="rounded-xl border border-bd bg-card p-4 animate-pulse space-y-2">
              <div className="h-4 bg-soft rounded w-1/2" />
              <div className="h-6 bg-soft rounded w-3/4" />
            </div>
          ))}
        </div>
      )}

      {!isLoading && contacts.length === 0 && (
        <Card className="p-8 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-soft text-navy/40">
            <Icon n="alert" s={22} />
          </div>
          <h4 className="mt-2 text-sm font-bold text-navy">No contacts configured</h4>
          <p className="mt-1 text-xs text-muted-foreground">
            Add essential emergency contacts so residents can reach help rapidly.
          </p>
        </Card>
      )}

      {!isLoading && contacts.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {contacts.map((contact) => (
            <Card key={contact.id} className="p-4 flex flex-col justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-sm font-bold text-navy truncate">{contact.title}</h4>
                  <span className="text-[10px] font-bold text-teal bg-teal/10 px-2 py-0.5 rounded border border-teal/20">
                    {contact.available_hours || '24/7'}
                  </span>
                </div>

                {contact.contact_person && (
                  <p className="text-xs text-muted-foreground">
                    Person: <strong className="text-navy">{contact.contact_person}</strong>
                  </p>
                )}
              </div>

              <div className="space-y-2 pt-2 border-t border-bd/60">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-sm font-bold text-navy tracking-wider">
                    {contact.phone_number}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDelete(contact.id)}
                    className="text-xs text-red-600 hover:text-red-800 font-semibold"
                  >
                    Delete
                  </button>
                </div>

                {contact.alternative_phone && (
                  <div className="text-xs text-muted-foreground pt-1 border-t border-bd/40">
                    Alt Phone: <strong className="font-mono text-navy">{contact.alternative_phone}</strong>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Modal: Add Contact */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <Card className="w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-bd/60 pb-3">
              <div>
                <h3 className="text-base font-bold text-navy">Add Emergency / Service Contact</h3>
                <p className="text-xs text-muted-foreground">Save official society contact details</p>
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
                  Service / Department Title *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Main Gate Security Desk"
                  className="w-full rounded-lg border border-bd bg-card px-3 py-2 text-xs text-navy focus:border-teal focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-navy mb-1">
                  Contact Person (Optional)
                </label>
                <input
                  type="text"
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  placeholder="e.g. Head Guard Ramesh"
                  className="w-full rounded-lg border border-bd bg-card px-3 py-2 text-xs text-navy focus:border-teal focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-navy mb-1">
                    Phone Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. 9876543210 or 100"
                    className="w-full rounded-lg border border-bd bg-card px-3 py-2 text-xs font-mono text-navy focus:border-teal focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-navy mb-1">
                    Alternative Phone
                  </label>
                  <input
                    type="text"
                    value={altPhone}
                    onChange={(e) => setAltPhone(e.target.value)}
                    placeholder="e.g. Landline / Back-up"
                    className="w-full rounded-lg border border-bd bg-card px-3 py-2 text-xs font-mono text-navy focus:border-teal focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-navy mb-1">
                    Operating Hours
                  </label>
                  <input
                    type="text"
                    value={hours}
                    onChange={(e) => setHours(e.target.value)}
                    placeholder="e.g. 24/7 or 9 AM - 6 PM"
                    className="w-full rounded-lg border border-bd bg-card px-3 py-2 text-xs text-navy focus:border-teal focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-navy mb-1">
                    Display Order
                  </label>
                  <input
                    type="number"
                    value={displayOrder}
                    onChange={(e) => setDisplayOrder(e.target.value)}
                    className="w-full rounded-lg border border-bd bg-card px-3 py-2 text-xs text-navy focus:border-teal focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-bd/60">
                <Btn type="button" onClick={() => setShowModal(false)} className="py-2 text-xs">
                  Cancel
                </Btn>
                <Btn type="submit" v="p" disabled={isSubmitting} className="py-2 text-xs">
                  {isSubmitting ? 'Saving...' : 'Save Contact'}
                </Btn>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
};
