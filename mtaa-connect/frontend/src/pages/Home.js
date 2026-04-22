import React from 'react';
import { Link, useNavigate } from 'react-router-dom';

const FEATURES = [
  { icon:'📖', label:'Community Stories',   desc:'Share experiences and inspiration' },
  { icon:'💼', label:'Job Alerts',           desc:'Casual, construction, househelp' },
  { icon:'🗺️', label:'Live Community Map',   desc:'Jobs, businesses & alerts nearby' },
  { icon:'🆘', label:'Emergency SOS',         desc:'One tap alerts the community' },
  { icon:'🤝', label:'Food & Donations',      desc:'Connect families with NGOs' },
  { icon:'🎓', label:'Free Skills Training',  desc:'Tailoring, coding, baking & more' },
  { icon:'🏪', label:'Business Directory',    desc:'Discover local shops & services' },
  { icon:'🛡️', label:'Safety Support',        desc:'Confidential GBV & abuse help' },
];

const STATS = [
  { value:'10,000+', label:'Community Members' },
  { value:'500+',    label:'Jobs Posted Monthly' },
  { value:'50+',     label:'NGO Partners' },
  { value:'100%',    label:'Free to Use' },
];

export default function Home() {
  const navigate = useNavigate();

  return (
    <div style={{ minHeight:'100vh', background:'linear-gradient(160deg,#0d1a0f 0%,#1a7a4a 55%,#0d4a2e 100%)', overflowX:'hidden' }}>
      {/* ── Top nav ── */}
      <nav style={{ padding:'14px 20px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <span style={{ fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:'1.25rem' }}>
          <span style={{ color:'#4ade80' }}>Mtaa</span>
          <span style={{ color:'#f1c40f' }}>Connect</span>
        </span>
        <div style={{ display:'flex', gap:'8px' }}>
          <Link to="/login"    style={{ padding:'8px 14px', borderRadius:'8px', color:'#9ca3af', border:'1px solid #374151', textDecoration:'none', fontSize:'14px', fontWeight:500 }}>Login</Link>
          <Link to="/register" style={{ padding:'8px 14px', borderRadius:'8px', background:'#1a7a4a', color:'white', textDecoration:'none', fontSize:'14px', fontWeight:600 }}>Join Free</Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <div style={{ maxWidth:880, margin:'0 auto', padding:'2rem 1.25rem', textAlign:'center', color:'white' }}>
        <h1 style={{ fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:'clamp(2rem,7vw,4rem)', lineHeight:1.1, marginBottom:'1rem' }}>
          The Platform Built<br />for the{' '}
          <span style={{ color:'#f1c40f', textShadow:'0 0 40px rgba(241,196,15,.4)' }}>Mtaa</span>
        </h1>
        <p style={{ fontSize:'clamp(0.95rem,3vw,1.1rem)', opacity:.85, maxWidth:540, margin:'0 auto 1.75rem', lineHeight:1.75 }}>
          Jobs, emergency alerts, food donations, skills training, a live community map, and more — all free, all for your community.
        </p>

        <div style={{ display:'flex', gap:'10px', justifyContent:'center', flexWrap:'wrap', marginBottom:'2.5rem' }}>
          <button onClick={() => navigate('/register')}
            className="btn btn-gold btn-lg"
            style={{ fontSize:'15px', boxShadow:'0 4px 24px rgba(241,196,15,.35)' }}>
            Join Free — Get Started →
          </button>
          <button onClick={() => navigate('/feed')}
            style={{ padding:'13px 24px', borderRadius:'10px', border:'1.5px solid rgba(255,255,255,.35)', background:'rgba(255,255,255,.1)', color:'white', cursor:'pointer', fontSize:'15px', fontWeight:600, fontFamily:'DM Sans,sans-serif', backdropFilter:'blur(8px)' }}>
            Browse Stories
          </button>
        </div>

        {/* Stats */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:'10px', maxWidth:480, margin:'0 auto 2.5rem', textAlign:'center' }}>
          <style>{`@media(min-width:480px){.stats-home{grid-template-columns:repeat(4,1fr)!important}}`}</style>
          <div className="stats-home" style={{ display:'contents' }}>
            {STATS.map(s => (
              <div key={s.label} style={{ background:'rgba(255,255,255,.1)', borderRadius:'12px', padding:'14px 10px', backdropFilter:'blur(6px)' }}>
                <div style={{ fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:'1.5rem', color:'#4ade80', lineHeight:1 }}>{s.value}</div>
                <div style={{ fontSize:'11px', opacity:.8, marginTop:'4px' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Feature cards */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:'10px' }}>
          <style>{`@media(min-width:600px){.feat-grid{grid-template-columns:repeat(4,1fr)!important}}`}</style>
          <div className="feat-grid" style={{ display:'contents' }}>
            {FEATURES.map(f => (
              <div key={f.label}
                onClick={() => navigate('/register')}
                style={{ background:'rgba(255,255,255,.08)', borderRadius:'14px', padding:'1rem .875rem', backdropFilter:'blur(6px)', cursor:'pointer', transition:'all .2s', border:'1px solid rgba(255,255,255,.1)', textAlign:'left' }}
                onMouseOver={e => { e.currentTarget.style.background='rgba(255,255,255,.16)'; e.currentTarget.style.transform='translateY(-2px)'; }}
                onMouseOut={e => { e.currentTarget.style.background='rgba(255,255,255,.08)'; e.currentTarget.style.transform='translateY(0)'; }}>
                <div style={{ fontSize:'26px', marginBottom:'6px' }}>{f.icon}</div>
                <div style={{ fontFamily:'Syne,sans-serif', fontWeight:700, fontSize:'13px', marginBottom:'3px' }}>{f.label}</div>
                <div style={{ fontSize:'11px', opacity:.75, lineHeight:1.4 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>

        <p style={{ marginTop:'2.5rem', opacity:.4, fontSize:'12px' }}>
          Serving Kibera · Mathare · Korogocho · Mukuru · Huruma · Dandora and all communities across Kenya
        </p>
      </div>
    </div>
  );
}
