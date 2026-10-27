import { useState } from 'react';
import { useAuth } from './AuthContext.jsx';
import { requestPasswordReset } from './authApi.js';
import { AUTH_BASE } from './config.js';

export default function LoginPage() {
  const { login, completeMfa } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [mfa, setMfa] = useState(null);
  const [code, setCode] = useState('');
  const [forgot, setForgot] = useState(false);
  const [forgotMessage, setForgotMessage] = useState('');

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const session = await login({ email: email.trim(), password });
      if (session?.mfaRequired) {
        setMfa(session);
        setCode('');
      }
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  async function onVerifyMfa(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await completeMfa({
        mfaChallengeToken: mfa.mfaChallengeToken,
        method: mfa.mfaMethod,
        code: code.trim(),
        email: email.trim(),
        password,
      });
    } catch (err) {
      setError(err.message || 'MFA verification failed');
    } finally {
      setBusy(false);
    }
  }

  async function onForgot(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setForgotMessage('');
    try {
      await requestPasswordReset(email.trim());
      setForgotMessage(
        'If an account exists with this email, a password reset link has been sent.',
      );
    } catch {
      setForgotMessage(
        'If an account exists with this email, a password reset link has been sent.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="shell auth-shell">
      <p className="brand">QVoyant ASM</p>
      <h1>Sign in</h1>
      <p className="muted">
        Use your auth-server account. The session is an httpOnly <code>accessToken</code> cookie.
      </p>

      {mfa ? (
        <form className="panel auth-form" onSubmit={onVerifyMfa}>
          <p className="muted">{mfa.message}</p>
          <label>
            Verification code
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="6-digit code"
              required
            />
          </label>
          {error ? <p className="auth-error">{error}</p> : null}
          <button type="submit" className="btn primary" disabled={busy}>
            {busy ? 'Verifying…' : 'Verify and continue'}
          </button>
          <button
            type="button"
            className="secondary"
            disabled={busy}
            onClick={() => {
              setMfa(null);
              setCode('');
              setError('');
            }}
          >
            Back
          </button>
        </form>
      ) : forgot ? (
        <form className="panel auth-form" onSubmit={onForgot}>
          <label>
            Email
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          {forgotMessage ? <p className="notice">{forgotMessage}</p> : null}
          {error ? <p className="auth-error">{error}</p> : null}
          <button type="submit" className="btn primary" disabled={busy}>
            {busy ? 'Sending…' : 'Send reset link'}
          </button>
          <button
            type="button"
            className="secondary"
            disabled={busy}
            onClick={() => {
              setForgot(false);
              setForgotMessage('');
            }}
          >
            Back to sign in
          </button>
        </form>
      ) : (
        <form className="panel auth-form" onSubmit={onSubmit}>
          <label>
            Email
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {error ? <p className="auth-error">{error}</p> : null}
          <button type="submit" className="btn primary" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
          <button type="button" className="linkish" onClick={() => setForgot(true)}>
            Forgot password
          </button>
        </form>
      )}

      <p className="hint">
        Auth server: <code>{AUTH_BASE}</code>
      </p>
    </main>
  );
}
