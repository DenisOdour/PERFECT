import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const AREAS = ['Kibera','Mathare','Korogocho','Mukuru kwa Njenga','Mukuru kwa Ruben','Huruma','Dandora','Kawangware','Kangemi','Githurai','Kayole','Embakasi','Ruiru','Other'];

export default function Register() {
  const [form, setForm] = useState({ name:'', phone:'', password:'', confirm:'', area:'', bio:'' });
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const pwMatch = !form.confirm || form.confirm === form.password;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim())     { toast.error('Enter your full name'); return; }
    if (!form.phone.trim())    { toast.error('Enter your phone number'); return; }
    if (form.password.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    if (form.password !== form.confirm) { toast.error('Passwords do not match'); return; }
    if (!form.area)            { toast.error('Select your area / estate'); return; }
    setLoading(true);
    try {
      await register({ name:form.name.trim(), phone:form.phone.trim(), password:form.password, area:form.area, ...(form.bio.trim() && { bio:form.bio.trim() }) });
      toast.success('Welcome to Mtaa Connect! 🎉');
      navigate('/feed');
    } catch (err) {
      toast.error(err.userMessage || err.response?.data?.message || 'Registration failed. Please try again.');
    } finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight:'100vh', background:'linear-gradient(160deg,#0d1a0f 0%,#1a7a4a 60%,#0d4a2e 100%)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'flex-start', padding:'1rem', paddingTop:'max(1rem,env(safe-area-inset-top))' }}>
      <div style={{ background:'white', borderRadius:'20px', padding:'1.75rem', width:'100%', maxWidth:'420px', boxShadow:'0 20px 60px rgba(0,0,0,.35)', marginBottom:'1rem' }}>
        {/* Logo */}
        <div style={{ textAlign:'center', marginBottom:'1.5rem' }}>
          <div style={{ fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:'1.8rem', lineHeight:1, marginBottom:'4px' }}>
            <span style={{ color:'#1a7a4a' }}>Mtaa</span><span style={{ color:'#e67e22' }}>Connect</span>
          </div>
          <p style={{ color:'var(--text-muted)', fontSize:'14px' }}>Join your community — completely free!</p>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Name */}
          <div className="form-group">
            <label className="form-label">Full Name *</label>
            <input type="text" className="form-input" placeholder="Your full name"
              value={form.name} onChange={e => set('name', e.target.value)} autoComplete="name" required />
          </div>

          {/* Phone */}
          <div className="form-group">
            <label className="form-label">Phone Number *</label>
            <input type="tel" className="form-input" placeholder="+254 700 000 000"
              value={form.phone} onChange={e => set('phone', e.target.value)} autoComplete="tel" required />
          </div>

          {/* Area */}
          <div className="form-group">
            <label className="form-label">Your Estate / Area *</label>
            <select className="form-input" value={form.area} onChange={e => set('area', e.target.value)} required>
              <option value="">Select your area…</option>
              {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>

          {/* Password */}
          <div className="form-group">
            <label className="form-label">Password * (min 6 characters)</label>
            <div style={{ position:'relative' }}>
              <input type={showPw ? 'text' : 'password'} className="form-input"
                placeholder="Create a strong password"
                value={form.password} onChange={e => set('password', e.target.value)}
                autoComplete="new-password" required style={{ paddingRight:'44px' }} />
              <button type="button" onClick={() => setShowPw(!showPw)}
                style={{ position:'absolute', right:'12px', top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', fontSize:'18px', lineHeight:1 }}>
                {showPw ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          {/* Confirm */}
          <div className="form-group">
            <label className="form-label">Confirm Password *</label>
            <input type="password" className="form-input"
              placeholder="Repeat your password"
              value={form.confirm} onChange={e => set('confirm', e.target.value)}
              autoComplete="new-password" required
              style={{ borderColor: !pwMatch && form.confirm ? '#c0392b' : '' }} />
            {!pwMatch && form.confirm && (
              <div style={{ color:'#c0392b', fontSize:'12px', marginTop:'4px' }}>⚠️ Passwords do not match</div>
            )}
          </div>

          {/* Bio */}
          <div className="form-group">
            <label className="form-label">About You (optional)</label>
            <textarea className="form-input" rows={2}
              placeholder="Tell the community a bit about yourself…"
              value={form.bio} onChange={e => set('bio', e.target.value)} />
          </div>

          <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={loading || !pwMatch}
            style={{ fontSize:'15px', padding:'13px' }}>
            {loading ? '⏳ Creating account…' : 'Create Free Account →'}
          </button>
        </form>

        <p style={{ textAlign:'center', marginTop:'16px', fontSize:'14px', color:'var(--text-muted)' }}>
          Have an account?{' '}
          <Link to="/login" style={{ color:'#1a7a4a', fontWeight:700, textDecoration:'none' }}>Login</Link>
        </p>
      </div>
    </div>
  );
}
