import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function Login() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [wakingUp, setWakingUp] = useState(false);
  const { login, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Where to redirect after login
  const from = location.state?.from?.pathname || '/feed';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!identifier.trim()) { toast.error('Enter your phone number or username'); return; }
    if (!password) { toast.error('Enter your password'); return; }
    setLoading(true);
    setWakingUp(false);

    // Show "waking up" message after 5 seconds if still loading
    const wakeTimer = setTimeout(() => setWakingUp(true), 5000);

    try {
      const user = await login(identifier.trim(), password);
      clearTimeout(wakeTimer);
      toast.success(`Karibu ${user.name}! 🎉`);
      if (user.role === 'admin' || user.role === 'super_admin') {
        navigate('/admin');
      } else {
        navigate(from, { replace: true });
      }
    } catch (err) {
      clearTimeout(wakeTimer);
      setWakingUp(false);
      const msg =
        err.userMessage ||
        err.response?.data?.message ||
        err.message ||
        'Login failed. Please check your credentials and try again.';
      toast.error(msg, { duration: 8000 });
    } finally {
      setLoading(false);
      setWakingUp(false);
    }
  };

  // Quick admin login
  const fillAdmin = () => {
    setIdentifier('denis254');
    setPassword('denodeno254');
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0d1a0f 0%, #1a7a4a 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ background: 'white', borderRadius: '20px', padding: '2rem', width: '100%', maxWidth: '420px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '2rem' }}>
            <span style={{ color: '#1a7a4a' }}>Mtaa</span>
            <span style={{ color: '#e67e22' }}>Connect</span>
          </div>
          <p style={{ color: '#5a7a60', fontSize: '14px', marginTop: '4px' }}>Sign in to your community account</p>
        </div>

        {/* Admin hint box */}
        <div style={{ background: '#e8f5ee', border: '1px solid #1a7a4a', borderRadius: '10px', padding: '10px 12px', marginBottom: '16px', fontSize: '13px' }}>
          <div style={{ fontWeight: 700, color: '#1a7a4a', marginBottom: '4px' }}>🔐 Admin Access</div>
          <div style={{ color: '#2d6a4f' }}>Username: <strong>denis254</strong> · Password: <strong>denodeno254</strong></div>
          <button type="button" onClick={fillAdmin}
            style={{ marginTop: '6px', fontSize: '11px', color: '#1a7a4a', background: 'none', border: '1px solid #1a7a4a', borderRadius: '5px', padding: '2px 8px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
            Auto-fill admin credentials
          </button>
        </div>

        {/* Waking up banner */}
        {wakingUp && (
          <div style={{ background: '#fef3e2', border: '1px solid #e67e22', borderRadius: '10px', padding: '10px 12px', marginBottom: '16px', fontSize: '13px', color: '#e67e22', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '20px' }}>⏳</span>
            <div>
              <strong>Server is waking up…</strong><br />
              Free hosting sleeps after inactivity. This usually takes 15–20 seconds. Please wait.
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#5a7a60', marginBottom: '5px' }}>
              Phone Number or Username
            </label>
            <input
              type="text"
              placeholder="+254 700 000 000  or  denis254"
              value={identifier}
              onChange={e => setIdentifier(e.target.value)}
              style={{ width: '100%', border: '1.5px solid #d4e6d8', borderRadius: '9px', padding: '11px 14px', fontSize: '14px', fontFamily: 'DM Sans, sans-serif', outline: 'none', boxSizing: 'border-box' }}
              onFocus={e => e.target.style.borderColor = '#1a7a4a'}
              onBlur={e => e.target.style.borderColor = '#d4e6d8'}
              autoComplete="username"
              required
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#5a7a60', marginBottom: '5px' }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Your password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                style={{ width: '100%', border: '1.5px solid #d4e6d8', borderRadius: '9px', padding: '11px 44px 11px 14px', fontSize: '14px', fontFamily: 'DM Sans, sans-serif', outline: 'none', boxSizing: 'border-box' }}
                onFocus={e => e.target.style.borderColor = '#1a7a4a'}
                onBlur={e => e.target.style.borderColor = '#d4e6d8'}
                autoComplete="current-password"
                required
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)}
                style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', color: '#5a7a60' }}>
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{ width: '100%', padding: '13px', background: loading ? '#9ca3af' : '#1a7a4a', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 700, fontSize: '16px', cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'DM Sans, sans-serif', transition: 'background 0.2s' }}>
            {loading
              ? wakingUp
                ? '⏳ Server waking up… please wait'
                : '⏳ Signing in…'
              : 'Login →'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '16px', fontSize: '14px', color: '#5a7a60' }}>
          Don't have an account?{' '}
          <Link to="/register" style={{ color: '#1a7a4a', fontWeight: 700, textDecoration: 'none' }}>
            Sign up free
          </Link>
        </p>
      </div>
    </div>
  );
}
