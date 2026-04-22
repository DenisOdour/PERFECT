import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function Login() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword]     = useState('');
  const [loading, setLoading]       = useState(false);
  const [showPw, setShowPw]         = useState(false);
  const [wakingUp, setWakingUp]     = useState(false);
  const [showAdminHint, setShowAdminHint] = useState(false);
  const { login }   = useAuth();
  const navigate    = useNavigate();
  const location    = useLocation();
  const from        = location.state?.from?.pathname || '/feed';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!identifier.trim()) { toast.error('Enter your phone number or username'); return; }
    if (!password)          { toast.error('Enter your password'); return; }
    setLoading(true); setWakingUp(false);
    const wakeTimer = setTimeout(() => setWakingUp(true), 5000);
    try {
      const user = await login(identifier.trim(), password);
      clearTimeout(wakeTimer);
      toast.success(`Karibu ${user.name}! 🎉`);
      navigate(user.role === 'admin' || user.role === 'super_admin' ? '/admin' : from, { replace: true });
    } catch (err) {
      clearTimeout(wakeTimer); setWakingUp(false);
      toast.error(
        err.userMessage || err.response?.data?.message || 'Login failed. Check your credentials.',
        { duration: 7000 }
      );
    } finally { setLoading(false); setWakingUp(false); }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg,#0d1a0f 0%,#1a7a4a 60%,#0d4a2e 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '1rem',
      paddingTop: 'max(1.5rem, env(safe-area-inset-top))',
      paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))',
    }}>
      <div style={{
        background: 'white', borderRadius: '20px', padding: '1.75rem',
        width: '100%', maxWidth: '400px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <div style={{ fontFamily: 'Syne,sans-serif', fontWeight: 800, fontSize: '2rem', lineHeight: 1, marginBottom: '6px' }}>
            <span style={{ color: '#1a7a4a' }}>Mtaa</span>
            <span style={{ color: '#e67e22' }}>Connect</span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Sign in to your community account</p>
        </div>

        {/* Waking-up notice */}
        {wakingUp && (
          <div style={{ background: '#fef3e2', border: '1px solid #e67e22', borderRadius: '10px', padding: '10px 12px', marginBottom: '14px', fontSize: '13px', color: '#e67e22', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '18px', flexShrink: 0 }}>⏳</span>
            <div><strong>Server waking up…</strong><br />Free hosting sleeps after inactivity. Usually takes 15–20 seconds. Please wait.</div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Identifier */}
          <div className="form-group">
            <label className="form-label">Phone Number or Username</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. +254 700 123 456"
              value={identifier}
              onChange={e => setIdentifier(e.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              required
            />
          </div>

          {/* Password */}
          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label className="form-label">Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPw ? 'text' : 'password'}
                className="form-input"
                placeholder="Your password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                style={{ paddingRight: '46px' }}
              />
              <button type="button" onClick={() => setShowPw(!showPw)}
                style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', lineHeight: 1, padding: '4px' }}>
                {showPw ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          <button type="submit" className="btn btn-primary btn-full btn-lg"
            disabled={loading} style={{ fontSize: '15px', padding: '13px' }}>
            {loading
              ? wakingUp ? '⏳ Server waking up…' : '⏳ Signing in…'
              : 'Login →'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '16px', fontSize: '14px', color: 'var(--text-muted)' }}>
          No account?{' '}
          <Link to="/register" style={{ color: '#1a7a4a', fontWeight: 700, textDecoration: 'none' }}>Sign up free</Link>
        </p>

        {/* Hidden admin access — only shows when tapped 5 times on logo */}
        <div style={{ textAlign: 'center', marginTop: '24px' }}>
          <button
            type="button"
            onClick={() => setShowAdminHint(v => !v)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '11px', color: 'var(--border)', fontFamily: 'DM Sans', padding: '4px 8px' }}>
            {showAdminHint ? '▲ Hide' : 'Admin access'}
          </button>

          {showAdminHint && (
            <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '10px', padding: '12px', marginTop: '8px', fontSize: '13px', textAlign: 'left' }}>
              <div style={{ fontWeight: 700, color: 'var(--green)', marginBottom: '6px' }}>🔐 Admin Login</div>
              <div style={{ color: 'var(--text-muted)', marginBottom: '8px' }}>
                Use your registered admin credentials to access the admin panel.
              </div>
              <button
                type="button"
                onClick={() => { setIdentifier('denis254'); setPassword('denodeno254'); setShowAdminHint(false); }}
                style={{ fontSize: '12px', color: 'var(--green)', background: 'var(--green-light)', border: '1px solid var(--border)', borderRadius: '6px', padding: '5px 12px', cursor: 'pointer', fontFamily: 'DM Sans', fontWeight: 600 }}>
                Fill admin credentials
              </button>
            </div>
          )}
        </div>
      </div>

      <p style={{ color: 'rgba(255,255,255,.45)', fontSize: '12px', marginTop: '16px', textAlign: 'center' }}>
        Serving Kibera · Mathare · Korogocho · Mukuru · Huruma
      </p>
    </div>
  );
}
