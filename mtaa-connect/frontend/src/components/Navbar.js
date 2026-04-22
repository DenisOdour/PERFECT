import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';

const AV_COLORS = ['#1a7a4a','#1a5fa8','#6c3483','#c0392b','#e67e22','#0e6655'];

export default function Navbar({ onEmergency }) {
  const { user, logout, unreadCount, isAdmin } = useAuth();
  const { isConnected, onlineCount } = useSocket();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const close = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const avatarColor = user ? AV_COLORS[user.name?.charCodeAt(0) % AV_COLORS.length] : '#1a7a4a';
  const initials = user ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '?';

  const NAV_LINKS = [
    { path:'/feed',label:'📖 Stories'}, {path:'/jobs',label:'💼 Jobs'},
    { path:'/map', label:'🗺️ Map'},     {path:'/donations',label:'🤝 Donate'},
    { path:'/skills',label:'🎓 Skills'},{path:'/businesses',label:'🏪 Directory'},
  ];

  return (
    <nav style={{ background:'#0d1a0f', color:'white', height:'var(--nav-h)', display:'flex', alignItems:'center', padding:'0 1rem', position:'sticky', top:0, zIndex:100, gap:'8px', borderBottom:'1px solid #1f3a23' }}>
      {/* Logo */}
      <Link to="/" style={{ textDecoration:'none', flexShrink:0 }}>
        <span style={{ fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:'1.15rem' }}>
          <span style={{ color:'#4ade80' }}>Mtaa</span>
          <span style={{ color:'#f1c40f' }}>Connect</span>
        </span>
      </Link>

      {/* Desktop nav links */}
      <div style={{ display:'flex', gap:'1px', flex:1, overflowX:'auto', scrollbarWidth:'none' }}>
        <style>{`@media(max-width:767px){.desk-nav{display:none!important}}`}</style>
        <div className="desk-nav" style={{ display:'flex', gap:'1px' }}>
          {NAV_LINKS.map(l => (
            <Link key={l.path} to={l.path} style={{ padding:'6px 10px', borderRadius:'7px', textDecoration:'none', fontSize:'13px', fontWeight:500, whiteSpace:'nowrap', transition:'all .15s', color:location.pathname===l.path?'white':'#9ca3af', background:location.pathname===l.path?'#1a7a4a':'transparent' }}>
              {l.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Right side */}
      <div style={{ display:'flex', alignItems:'center', gap:'6px', flexShrink:0, marginLeft:'auto' }}>
        {/* SOS */}
        <button onClick={onEmergency} style={{ background:'#c0392b', color:'white', border:'none', borderRadius:'8px', padding:'6px 10px', cursor:'pointer', fontSize:'13px', fontWeight:700, fontFamily:'DM Sans,sans-serif', WebkitTapHighlightColor:'transparent' }}>
          🆘 SOS
        </button>

        {user ? (
          <>
            {/* Bell */}
            <Link to="/profile" style={{ position:'relative', textDecoration:'none', fontSize:'20px', lineHeight:1 }}>
              🔔
              {unreadCount > 0 && (
                <span style={{ position:'absolute', top:-4, right:-4, background:'#c0392b', color:'white', borderRadius:'50%', width:15, height:15, fontSize:'9px', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700 }}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Link>

            {/* Admin badge — desktop only */}
            {isAdmin && (
              <Link to="/admin" style={{ display:'none', background:'#f1c40f', color:'#0d1a0f', fontSize:'10px', fontWeight:800, padding:'3px 7px', borderRadius:'4px', textDecoration:'none' }}
                className="desk-only">
                ADMIN
              </Link>
            )}

            {/* Avatar */}
            <div ref={menuRef} style={{ position:'relative' }}>
              <div onClick={() => setMenuOpen(v => !v)} style={{ width:32, height:32, borderRadius:'50%', background:avatarColor, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'12px', fontWeight:700, color:'white', flexShrink:0, border:menuOpen?'2px solid #4ade80':'2px solid transparent', transition:'border .15s', WebkitTapHighlightColor:'transparent' }}>
                {user.avatar ? <img src={user.avatar} alt="" style={{ width:'100%', height:'100%', borderRadius:'50%', objectFit:'cover' }} /> : initials}
              </div>
              {menuOpen && (
                <div style={{ position:'absolute', top:38, right:0, background:'white', borderRadius:'12px', border:'1px solid var(--border)', padding:'8px', minWidth:180, zIndex:200, boxShadow:'0 8px 32px rgba(0,0,0,.15)' }}>
                  <div style={{ padding:'8px 10px', borderBottom:'1px solid var(--border)', marginBottom:'4px' }}>
                    <div style={{ fontWeight:700, fontSize:'14px', color:'var(--text)' }}>{user.name}</div>
                    <div style={{ fontSize:'11px', color:'var(--text-muted)' }}>📍 {user.area}</div>
                    {user.role !== 'user' && <div style={{ fontSize:'10px', color:'var(--green)', fontWeight:700, marginTop:2 }}>{user.role.replace('_',' ').toUpperCase()}</div>}
                  </div>
                  {[
                    { label:'👤 My Profile', path:'/profile' },
                    { label:'💬 Messages', path:'/messages' },
                    ...(isAdmin ? [{ label:'⚙️ Admin Panel', path:'/admin' }] : []),
                  ].map(item => (
                    <Link key={item.path} to={item.path} onClick={() => setMenuOpen(false)}
                      style={{ display:'block', padding:'9px 10px', textDecoration:'none', fontSize:'14px', color:'var(--text)', borderRadius:'8px', transition:'background .15s' }}
                      onMouseOver={e => e.currentTarget.style.background='#e8f5ee'}
                      onMouseOut={e => e.currentTarget.style.background='transparent'}>
                      {item.label}
                    </Link>
                  ))}
                  <div style={{ borderTop:'1px solid var(--border)', marginTop:'4px', paddingTop:'4px' }}>
                    <button onClick={() => { logout(); navigate('/'); setMenuOpen(false); }}
                      style={{ display:'block', width:'100%', padding:'9px 10px', background:'none', border:'none', cursor:'pointer', fontSize:'14px', color:'#c0392b', textAlign:'left', borderRadius:'8px', fontFamily:'DM Sans,sans-serif' }}
                      onMouseOver={e => e.currentTarget.style.background='#fdecea'}
                      onMouseOut={e => e.currentTarget.style.background='transparent'}>
                      🚪 Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div style={{ display:'flex', gap:'6px' }}>
            <Link to="/login"    style={{ padding:'7px 11px', borderRadius:'7px', fontSize:'13px', fontWeight:500, textDecoration:'none', color:'#9ca3af', border:'1px solid #374151' }}>Login</Link>
            <Link to="/register" style={{ padding:'7px 11px', borderRadius:'7px', fontSize:'13px', fontWeight:600, textDecoration:'none', color:'white', background:'#1a7a4a' }}>Sign Up</Link>
          </div>
        )}
      </div>
    </nav>
  );
}
