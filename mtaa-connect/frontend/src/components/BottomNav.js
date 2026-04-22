import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const NAV_ITEMS = [
  { path: '/feed',       icon: '📖', label: 'Stories' },
  { path: '/jobs',       icon: '💼', label: 'Jobs' },
  { path: '/map',        icon: '🗺️', label: 'Map' },
  { path: '/donations',  icon: '🤝', label: 'Donate' },
  { path: '/skills',     icon: '🎓', label: 'Skills' },
  { path: '/more',       icon: '⋯',  label: 'More' },
];

const MORE_ITEMS = [
  { path: '/businesses', icon: '🏪', label: 'Directory' },
  { path: '/reports',    icon: '📢', label: 'Reports' },
  { path: '/safety',     icon: '🛡️', label: 'Safety' },
  { path: '/messages',   icon: '💬', label: 'Messages' },
  { path: '/profile',    icon: '👤', label: 'Profile' },
];

export default function BottomNav() {
  const location = useLocation();
  const { isAdmin } = useAuth();
  const [showMore, setShowMore] = React.useState(false);

  // Don't show on auth pages or home
  const hiddenPaths = ['/', '/login', '/register'];
  if (hiddenPaths.includes(location.pathname)) return null;

  const mainItems = isAdmin
    ? [
        { path:'/feed',  icon:'📖', label:'Stories' },
        { path:'/jobs',  icon:'💼', label:'Jobs' },
        { path:'/map',   icon:'🗺️', label:'Map' },
        { path:'/admin', icon:'⚙️', label:'Admin' },
        { path:'/more',  icon:'⋯',  label:'More' },
      ]
    : NAV_ITEMS;

  return (
    <>
      {/* More drawer */}
      {showMore && (
        <div style={{ position:'fixed', inset:0, zIndex:89 }} onClick={() => setShowMore(false)}>
          <div style={{ position:'absolute', bottom:'var(--bottom-nav-h)', left:0, right:0, background:'#0d1a0f', borderTop:'1px solid #1f3a23', padding:'12px 16px', display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:'4px' }}
            onClick={e => e.stopPropagation()}>
            {MORE_ITEMS.map(item => (
              <Link key={item.path} to={item.path} onClick={() => setShowMore(false)}
                style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'3px', padding:'8px 4px', textDecoration:'none', borderRadius:'10px', background: location.pathname === item.path ? '#1a7a4a' : 'transparent' }}>
                <span style={{ fontSize:'22px', lineHeight:1 }}>{item.icon}</span>
                <span style={{ fontSize:'10px', color: location.pathname === item.path ? '#4ade80' : '#9ca3af', fontFamily:'DM Sans,sans-serif' }}>{item.label}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Bottom nav bar */}
      <nav className="bottom-nav">
        <div className="bottom-nav-items">
          {mainItems.map(item => {
            const isMore = item.path === '/more';
            const isActive = isMore ? showMore : location.pathname === item.path;
            return (
              <button key={item.path}
                onClick={() => { if (isMore) { setShowMore(v => !v); } else { setShowMore(false); } }}
                style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'2px', padding:'6px 4px', cursor:'pointer', border:'none', background:'transparent', flex:1, WebkitTapHighlightColor:'transparent', minWidth:0 }}>
                {isMore ? (
                  <>
                    <span style={{ fontSize:'22px', lineHeight:1, color: showMore ? '#4ade80' : 'white' }}>{item.icon}</span>
                    <span style={{ fontSize:'9px', color: showMore ? '#4ade80' : '#6b7280', fontFamily:'DM Sans,sans-serif' }}>{item.label}</span>
                  </>
                ) : (
                  <Link to={item.path} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'2px', textDecoration:'none', width:'100%' }}
                    onClick={() => setShowMore(false)}>
                    <span style={{ fontSize:'22px', lineHeight:1 }}>{item.icon}</span>
                    <span style={{ fontSize:'9px', color: isActive ? '#4ade80' : '#6b7280', fontFamily:'DM Sans,sans-serif', fontWeight: isActive ? 600 : 400 }}>{item.label}</span>
                  </Link>
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
