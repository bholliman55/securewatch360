import { useState } from 'react';
import { Shield, Mail, Lock, Eye, EyeOff, AlertCircle, Loader } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const { signIn, signUp, resetPassword } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (isForgotPassword) {
        const { error } = await resetPassword(email);
        if (error) {
          setError(error.message);
        } else {
          setSuccess('Password reset email sent. Check your inbox.');
          setTimeout(() => {
            setIsForgotPassword(false);
            setSuccess('');
          }, 3000);
        }
      } else if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) {
          setError(error.message);
        }
      } else {
        const { error } = await signUp(email, password, fullName);
        if (error) {
          setError(error.message);
        } else {
          setSuccess('Account created successfully! You can now sign in.');
          setTimeout(() => {
            setIsLogin(true);
            setSuccess('');
          }, 2000);
        }
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#07111f] via-[#0d1e33] to-[#07111f] flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-[#1565c0] to-[#29b6f6] rounded-2xl mb-4">
            <Shield className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-2 tracking-wide">SecureWatch360 AI</h1>
          <p className="text-[#b0c4de]">
            {isForgotPassword
              ? 'Reset your password'
              : isLogin
              ? 'Sign in to your account'
              : 'Create your account'}
          </p>
        </div>

        <div className="bg-[var(--sw-surface)] rounded-xl shadow-2xl border border-[var(--sw-border)] p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {!isLogin && !isForgotPassword && (
              <div>
                <label className="block text-sm font-medium text-[var(--sw-text-muted)] mb-2 uppercase tracking-[0.08em]">
                  Full Name
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="John Doe"
                  required={!isLogin}
                  className="w-full px-4 py-3 rounded-lg border border-[var(--sw-border)] bg-[var(--sw-surface-elevated)] text-[var(--sw-text-primary)] focus:outline-none focus:ring-2 focus:ring-[#1e88e5]"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-[var(--sw-text-muted)] mb-2 uppercase tracking-[0.08em]">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--sw-text-muted)]" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full pl-10 pr-4 py-3 rounded-lg border border-[var(--sw-border)] bg-[var(--sw-surface-elevated)] text-[var(--sw-text-primary)] focus:outline-none focus:ring-2 focus:ring-[#1e88e5]"
                />
              </div>
            </div>

            {!isForgotPassword && (
              <div>
                <label className="block text-sm font-medium text-[var(--sw-text-muted)] mb-2 uppercase tracking-[0.08em]">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--sw-text-muted)]" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                    className="w-full pl-10 pr-12 py-3 rounded-lg border border-[var(--sw-border)] bg-[var(--sw-surface-elevated)] text-[var(--sw-text-primary)] focus:outline-none focus:ring-2 focus:ring-[#1e88e5]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--sw-text-muted)] hover:text-[var(--sw-text-primary)]"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            )}

            {error && (
              <div className="flex items-start space-x-3 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
              </div>
            )}

            {success && (
              <div className="flex items-start space-x-3 p-4 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg">
                <AlertCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-green-800 dark:text-green-300">{success}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-[#1565c0] hover:bg-[#1e88e5] text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {loading ? (
                <>
                  <Loader className="w-5 h-5 animate-spin mr-2" />
                  {isForgotPassword ? 'Sending...' : isLogin ? 'Signing in...' : 'Creating account...'}
                </>
              ) : (
                <>{isForgotPassword ? 'Send Reset Link' : isLogin ? 'Sign In' : 'Create Account'}</>
              )}
            </button>
          </form>

          <div className="mt-6 space-y-3">
            {!isForgotPassword && isLogin && (
              <button
                onClick={() => setIsForgotPassword(true)}
                className="w-full text-center text-sm text-[#29b6f6] hover:underline"
              >
                Forgot your password?
              </button>
            )}

            {isForgotPassword ? (
              <button
                onClick={() => {
                  setIsForgotPassword(false);
                  setError('');
                  setSuccess('');
                }}
                className="w-full text-center text-sm text-[var(--sw-text-muted)] hover:text-[var(--sw-text-primary)]"
              >
                Back to sign in
              </button>
            ) : (
              <div className="text-center">
                <span className="text-sm text-[var(--sw-text-muted)]">
                  {isLogin ? "Don't have an account? " : 'Already have an account? '}
                </span>
                <button
                  onClick={() => {
                    setIsLogin(!isLogin);
                    setError('');
                    setSuccess('');
                  }}
                  className="text-sm text-[#29b6f6] hover:underline font-medium"
                >
                  {isLogin ? 'Sign up' : 'Sign in'}
                </button>
              </div>
            )}
          </div>
        </div>

        <p className="text-center text-sm text-[#8ab4d4] mt-8">
          Secure multi-agent security operations platform
        </p>
      </div>
    </div>
  );
}
