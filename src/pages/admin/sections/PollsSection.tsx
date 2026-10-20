// ==============================================================================
// SmartResolve Admin: Community Polls & Voting Management
// ==============================================================================

import React, { useState, useEffect } from 'react';
import { Card, Btn, Pill } from '../../../components/ui/Primitives';
import { Icon } from '../../../components/ui/Icon';
import {
  fetchSocietyPolls,
  createPoll,
  closePoll,
  type PollWithOptions,
} from '../../../lib/communityService';

interface PollsSectionProps {
  societyId: string;
  userId: string;
}

export const PollsSection: React.FC<PollsSectionProps> = ({ societyId, userId }) => {
  const [polls, setPolls] = useState<PollWithOptions[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [question, setQuestion] = useState('');
  const [description, setDescription] = useState('');
  const [closingDate, setClosingDate] = useState('');
  const [votingUnit, setVotingUnit] = useState<'per_flat' | 'per_resident'>('per_flat');
  const [options, setOptions] = useState<string[]>(['Yes', 'No']);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const loadPolls = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: fetchErr } = await fetchSocietyPolls(societyId);
      if (fetchErr) setError(fetchErr);
      else setPolls(data || []);
    } catch (e: any) {
      setError(e.message || 'Failed to load community polls');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPolls();
  }, [societyId]);

  const handleAddOption = () => {
    if (options.length < 6) {
      setOptions([...options, '']);
    }
  };

  const handleRemoveOption = (idx: number) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== idx));
    }
  };

  const handleOptionChange = (idx: number, val: string) => {
    const updated = [...options];
    updated[idx] = val;
    setOptions(updated);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setModalError(null);

    try {
      const res = await createPoll(societyId, userId, {
        question,
        description,
        closing_date: closingDate,
        voting_unit: votingUnit,
        options,
      });

      if (res.error) {
        setModalError(res.error);
      } else {
        setToast('Community poll published successfully!');
        setShowModal(false);
        setQuestion('');
        setDescription('');
        setClosingDate('');
        setVotingUnit('per_flat');
        setOptions(['Yes', 'No']);
        await loadPolls();
      }
    } catch (err: any) {
      setModalError(err.message || 'Failed to create poll');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClosePoll = async (pollId: string) => {
    if (!confirm('Are you sure you want to close voting for this poll?')) return;
    try {
      const res = await closePoll(pollId);
      if (res.success) {
        setToast('Poll voting closed.');
        await loadPolls();
      } else {
        setError(res.error || 'Failed to close poll');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to close poll');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-navy">Community Polls & Referendums</h2>
          <p className="text-xs text-muted-foreground">
            Configure transparent polls with per-flat or per-resident voting rules.
          </p>
        </div>

        <Btn v="p" onClick={() => setShowModal(true)} className="py-2 text-xs">
          <Icon n="plus" s={14} />
          <span>Create Poll</span>
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map((n) => (
            <div key={n} className="rounded-xl border border-bd bg-card p-5 animate-pulse space-y-3">
              <div className="h-5 bg-soft rounded w-2/3" />
              <div className="h-4 bg-soft rounded w-full" />
              <div className="h-10 bg-soft rounded w-full" />
            </div>
          ))}
        </div>
      )}

      {!isLoading && polls.length === 0 && (
        <Card className="p-8 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-soft text-navy/40">
            <Icon n="check" s={22} />
          </div>
          <h4 className="mt-2 text-sm font-bold text-navy">No polls created yet</h4>
          <p className="mt-1 text-xs text-muted-foreground">
            Create a poll to collect feedback or votes on society decisions.
          </p>
        </Card>
      )}

      {!isLoading && polls.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {polls.map((poll) => {
            const isClosed = !poll.is_active || new Date(poll.closing_date) <= new Date();

            return (
              <Card key={poll.id} className="p-5 flex flex-col justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold text-muted-foreground">
                      Rule: <strong className="text-navy">{poll.voting_unit === 'per_flat' ? '1 Vote / Flat' : '1 Vote / Member'}</strong>
                    </span>
                    <Pill tone={isClosed ? 'w' : 't'}>
                      {isClosed ? 'CLOSED' : 'ACTIVE'}
                    </Pill>
                  </div>

                  <h4 className="text-sm font-bold text-navy">{poll.question}</h4>
                  {poll.description && (
                    <p className="text-xs text-muted-foreground leading-relaxed">{poll.description}</p>
                  )}
                  <div className="text-[11px] text-muted-foreground">
                    Closing: <strong>{new Date(poll.closing_date).toLocaleDateString()}</strong> • Total Votes: <strong>{poll.total_votes}</strong>
                  </div>
                </div>

                {/* Options Breakdown */}
                <div className="space-y-2 pt-2 border-t border-bd/60">
                  {poll.options.map((opt) => {
                    const percent = poll.total_votes > 0 ? Math.round((opt.vote_count / poll.total_votes) * 100) : 0;
                    return (
                      <div key={opt.id} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-navy font-medium">{opt.option_text}</span>
                          <span className="font-mono font-bold text-navy">
                            {opt.vote_count} ({percent}%)
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-soft rounded-full overflow-hidden">
                          <div
                            className="h-full bg-teal transition-all duration-500 rounded-full"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-2 border-t border-bd/60 text-xs">
                  <span className="text-muted-foreground">
                    By {poll.creator_name || 'Admin'}
                  </span>
                  {!isClosed && (
                    <button
                      type="button"
                      onClick={() => handleClosePoll(poll.id)}
                      className="text-amber-700 font-semibold hover:underline"
                    >
                      Close Voting
                    </button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal: Create Poll */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <Card className="w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-bd/60 pb-3">
              <div>
                <h3 className="text-base font-bold text-navy">Create Community Poll</h3>
                <p className="text-xs text-muted-foreground">Set voting questions and voter quota</p>
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
                  Poll Question *
                </label>
                <input
                  type="text"
                  required
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="e.g. Approve installation of EV charging stations in Basement 1?"
                  className="w-full rounded-lg border border-bd bg-card px-3 py-2 text-xs text-navy focus:border-teal focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-navy mb-1">
                  Description / Context (Optional)
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Provide background on costs, vendors, or timelines..."
                  className="w-full rounded-lg border border-bd bg-card p-2.5 text-xs text-navy focus:border-teal focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-navy mb-1">
                    Voting Unit *
                  </label>
                  <select
                    value={votingUnit}
                    onChange={(e) => setVotingUnit(e.target.value as any)}
                    className="w-full rounded-lg border border-bd bg-card px-3 py-2 text-xs text-navy focus:border-teal focus:outline-none"
                  >
                    <option value="per_flat">1 Vote Per Flat (Society Standard)</option>
                    <option value="per_resident">1 Vote Per Resident (Member Level)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-navy mb-1">
                    Voting Deadline *
                  </label>
                  <input
                    type="date"
                    required
                    value={closingDate}
                    onChange={(e) => setClosingDate(e.target.value)}
                    className="w-full rounded-lg border border-bd bg-card px-3 py-2 text-xs text-navy focus:border-teal focus:outline-none"
                  />
                </div>
              </div>

              {/* Dynamic Options List */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-navy">
                    Voting Options (At least 2) *
                  </label>
                  {options.length < 6 && (
                    <button
                      type="button"
                      onClick={handleAddOption}
                      className="text-xs text-teal font-semibold hover:underline"
                    >
                      + Add Option
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  {options.map((opt, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        required
                        value={opt}
                        onChange={(e) => handleOptionChange(idx, e.target.value)}
                        placeholder={`Option ${idx + 1}`}
                        className="flex-1 rounded-lg border border-bd bg-card px-3 py-1.5 text-xs text-navy focus:border-teal focus:outline-none"
                      />
                      {options.length > 2 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveOption(idx)}
                          className="text-red-500 hover:text-red-700 text-xs px-1 font-bold"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-bd/60">
                <Btn type="button" onClick={() => setShowModal(false)} className="py-2 text-xs">
                  Cancel
                </Btn>
                <Btn type="submit" v="p" disabled={isSubmitting} className="py-2 text-xs">
                  {isSubmitting ? 'Creating Poll...' : 'Publish Poll'}
                </Btn>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
};
