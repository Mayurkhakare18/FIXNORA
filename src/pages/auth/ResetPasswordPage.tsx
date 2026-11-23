// ==============================================================================
// SmartResolve Authentication: Reset Password Page
// Sets new password for users arriving from recovery email token
// ==============================================================================

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Card, Btn } from '../../components/ui/Primitives';
import { Icon } from '../../components/ui/Icon';

export const ResetPasswordPage: React.FC = () => {
  const { updatePassword } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters in length.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match. Please verify your entries.');
      return;
    }

    setIsLoading(true);

    try {
      const result = await updatePassword(newPassword);
      if (!result.success) {
        setError(result.error || 'Failed to update password');
        setIsLoading(false);
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        navigate('/auth/login', { replace: true });
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-background">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 text-2xl font-bold text-navy">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#263B52] text-white shadow-md">
              <Icon n="check" s={20} />
            </span>
            <span>Fixnora</span>
          </Link>
          <h2 className="mt-4 text-xl font-bold text-navy">Set New Password</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Create a secure new password for your account
          </p>
        </div>

        <Card className="p-6 shadow-lg">
          {success ? (
            <div className="text-center py-6 space-y-3">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-teal/20 text-teal">
                <Icon n="check" s={24} />
              </div>
              <h3 className="text-lg font-bold text-navy">Password Updated</h3>
              <p className="text-xs text-muted-foreground">
                Your password has been reset successfully. Redirecting to login...
              </p>
            </div>
          ) : (
            <>
              {error && (
                <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-700 flex items-start gap-2">
                  <Icon n="alert" s={16} c="text-red-500 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-navy mb-1.5">
                    New Password
                  </label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                    className="w-full rounded-lg border border-bd bg-card px-3.5 py-2.5 text-sm text-navy placeholder:text-muted-foreground/50 focus:border-teal focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-navy mb-1.5">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat new password"
                    className="w-full rounded-lg border border-bd bg-card px-3.5 py-2.5 text-sm text-navy placeholder:text-muted-foreground/50 focus:border-teal focus:outline-none"
                  />
                </div>

                <Btn
                  type="submit"
                  v="p"
                  disabled={isLoading}
                  className="w-full py-3 mt-2 shadow-md flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <Icon n="refresh-cw" s={16} className="animate-spin" />
                      <span>Updating Password...</span>
                    </>
                  ) : (
                    <span>Update Password</span>
                  )}
                </Btn>
              </form>
            </>
          )}
        </Card>
      </div>
    </div>
  );
};
