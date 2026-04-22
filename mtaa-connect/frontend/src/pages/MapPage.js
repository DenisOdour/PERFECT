import React, { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import API from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import toast from 'react-hot-toast';

// ── Fix Leaflet default marker icons ──────────────────────────────
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// ── Custom emoji map icons ─────────────────────────────────────────
const mkIcon = (emoji, bg, size = 34) => L.divIcon({
  html: `<div style="background:${bg};width:${size}px;height:${size}px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:${Math.round(size * 0.47)}px;border:2.5px solid white;box-shadow:0 2px 10px rgba(0,0,0,0.35);cursor:pointer">${emoji}</div>`,
  className: '', iconSize: [size, size], iconAnchor: [size / 2, size / 2],
});

const ICONS = {
  myLocation:  mkIcon('📍', '#c0392b', 38),
  job:         mkIcon('💼', '#1a5fa8'),
  report:      mkIcon('📢', '#e67e22'),
  user:        mkIcon('👤', '#6c3483'),
  admin:       mkIcon('👮', '#1a7a4a'),
  emergency: {
    violence:      mkIcon('⚔️', '#c0392b'),
    fire:          mkIcon('🔥', '#e74c3c'),
    medical:       mkIcon('🏥', '#2980b9'),
    missing_child: mkIcon('👶', '#8e44ad'),
    flood:         mkIcon('💧', '#1a6b5a'),
    other:         mkIcon('🚨', '#c0392b'),
  },
  biz: {
    food:      mkIcon('🍗', '#e67e22'),
    salon:     mkIcon('💇', '#e91e8c'),
    tech:      mkIcon('📱', '#1a5fa8'),
    barbershop:mkIcon('✂️', '#1a7a4a'),
    tailoring: mkIcon('🧵', '#6c3483'),
    health:    mkIcon('💊', '#c0392b'),
    transport: mkIcon('🚗', '#5d6d7e'),
    hardware:  mkIcon('🔨', '#9a7d0a'),
    default:   mkIcon('🏪', '#1a7a4a'),
  },
};

const DEFAULT_CENTER = [-1.2921, 36.8219]; // Nairobi

// ── Auto-locate component ──────────────────────────────────────────
function AutoLocate({ onFound }) {
  const map = useMap();
  useEffect(() => {
    map.locate({ setView: false });
    map.on('locationfound', (e) => onFound([e.latlng.lat, e.latlng.lng]));
    map.on('locationerror', () => {});
  }, [map, onFound]);
  return null;
}

// ── Layer toggle button ────────────────────────────────────────────
function LayerBtn({ icon, label, count, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: '5px',
      padding: '6px 10px', borderRadius: '20px', border: '1.5px solid',
      cursor: 'pointer', fontSize: '12px', fontWeight: 600,
      fontFamily: 'DM Sans, sans-serif', transition: 'all .18s',
      borderColor: active ? '#1a7a4a' : 'var(--border)',
      background:  active ? 'var(--green-light)' : 'white',
      color:       active ? '#1a7a4a' : 'var(--text-muted)',
      whiteSpace: 'nowrap',
    }}>
      <span>{icon}</span>
      <span className="layer-label">{label}</span>
      {count > 0 && (
        <span style={{ background: active ? '#1a7a4a' : '#d4e6d8', color: active ? 'white' : 'var(--text-muted)', borderRadius: '10px', padding: '0 5px', fontSize: '10px', minWidth: '18px', textAlign: 'center' }}>
          {count}
        </span>
      )}
    </button>
  );
}

export default function MapPage() {
  const { user, isAdmin } = useAuth();
  const { liveLocations, emitLocation } = useSocket();
  const [mapData, setMapData]   = useState({ businesses: [], jobs: [], emergencies: [], reports: [], users: [] });
  const [myPos, setMyPos]       = useState(null);
  const [loading, setLoading]   = useState(true);
  const [sharing, setSharing]   = useState(user?.shareLocation || false);
  const [layers, setLayers]     = useState({ businesses: true, jobs: true, emergencies: true, reports: true, users: true });
  const [activeInfo, setActiveInfo] = useState(null); // selected marker info for mobile panel

  const loadMap = useCallback(async (lat, lng) => {
    try {
      const { data } = await API.get('/maps/overview', {
        params: { lat: lat || DEFAULT_CENTER[0], lng: lng || DEFAULT_CENTER[1], radius: 15000 }
      });
      setMapData(data.layers || {});
    } catch { /* show empty map */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      pos => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setMyPos([lat, lng]);
        loadMap(lat, lng);
      },
      () => loadMap(),
      { timeout: 8000, enableHighAccuracy: false }
    );
  }, [loadMap]);

  const toggleSharing = async () => {
    if (!user) { toast.error('Login to share your location'); return; }
    const next = !sharing;
    try {
      if (myPos) {
        await API.post('/maps/update-location', { lat: myPos[0], lng: myPos[1], shareLocation: next });
        if (next) emitLocation(myPos[0], myPos[1]);
      }
      setSharing(next);
      toast.success(next ? '📍 Location sharing ON — you appear on the community map' : '📍 Location sharing OFF');
    } catch { toast.error('Could not update location settings'); }
  };

  const toggleLayer = (key) => setLayers(prev => ({ ...prev, [key]: !prev[key] }));

  // Merge API users + live socket locations
  const allUsers = [
    ...(mapData.users || []),
    ...Object.values(liveLocations).filter(l => !(mapData.users || []).find(u => u.id === l.userId))
  ];

  const LAYER_DEFS = [
    { key: 'businesses', icon: '🏪', label: 'Shops',      count: (mapData.businesses || []).length },
    { key: 'jobs',       icon: '💼', label: 'Jobs',        count: (mapData.jobs || []).length },
    { key: 'emergencies',icon: '🚨', label: 'Alerts',      count: (mapData.emergencies || []).length },
    { key: 'reports',    icon: '📢', label: 'Reports',     count: (mapData.reports || []).length },
    { key: 'users',      icon: '👥', label: 'People',      count: allUsers.length },
  ];

  const totalMarkers = LAYER_DEFS.reduce((a, l) => a + l.count, 0);

  return (
    <div style={{ maxWidth: 1300, margin: '0 auto', padding: '10px' }}>
      {/* ── Header ── */}
      <div style={{ marginBottom: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
          <div>
            <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 'clamp(1.1rem, 4vw, 1.4rem)', lineHeight: 1.2 }}>
              🗺️ Community Map
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '2px' }}>
              {loading ? 'Loading…' : `${totalMarkers} items near you`}
              {isAdmin && ` · Admin: seeing ${allUsers.length} user(s)`}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {isAdmin && (
              <button onClick={() => loadMap(myPos?.[0], myPos?.[1])} className="btn btn-secondary btn-sm">
                🔄 Refresh
              </button>
            )}
            <button onClick={toggleSharing}
              className={`btn btn-sm ${sharing ? 'btn-danger' : 'btn-secondary'}`}>
              {sharing ? '🔴 Stop Sharing' : '📍 Share Location'}
            </button>
          </div>
        </div>

        {/* Layer toggles — horizontally scrollable on mobile */}
        <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
          <style>{`.layer-label{display:none}@media(min-width:480px){.layer-label{display:inline}}`}</style>
          {LAYER_DEFS.map(l => (
            <LayerBtn key={l.key} icon={l.icon} label={l.label} count={l.count}
              active={layers[l.key]} onClick={() => toggleLayer(l.key)} />
          ))}
        </div>
      </div>

      {/* ── Map + Side Panel ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px' }}>
        <style>{`@media(min-width:900px){.map-side-grid{grid-template-columns:1fr 260px!important}}`}</style>
        <div className="map-side-grid" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px' }}>

          {/* Map */}
          <div style={{ borderRadius: 'var(--radius)', overflow: 'hidden', border: '1px solid var(--border)', height: 'clamp(300px, 55vw, 540px)', position: 'relative', boxShadow: 'var(--shadow)' }}>
            {loading ? (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', flexDirection: 'column', gap: '12px' }}>
                <div className="spinner" />
                <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Loading community map…</p>
              </div>
            ) : (
              <MapContainer
                center={myPos || DEFAULT_CENTER}
                zoom={myPos ? 14 : 12}
                style={{ height: '100%', width: '100%' }}
                zoomControl={false}
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                />
                <AutoLocate onFound={pos => { setMyPos(pos); loadMap(pos[0], pos[1]); }} />

                {/* My location */}
                {myPos && (
                  <>
                    <Marker position={myPos} icon={ICONS.myLocation}>
                      <Popup>
                        <div style={{ fontFamily: 'DM Sans, sans-serif', minWidth: '140px' }}>
                          <strong style={{ fontSize: '14px' }}>📍 You are here</strong>
                          <div style={{ fontSize: '12px', color: '#5a7a60', marginTop: '2px' }}>{user?.area || 'Your location'}</div>
                          {sharing && <div style={{ fontSize: '11px', color: '#1a7a4a', marginTop: '4px', fontWeight: 600 }}>✓ Location shared with community</div>}
                        </div>
                      </Popup>
                    </Marker>
                    <Circle center={myPos} radius={400}
                      pathOptions={{ color: '#1a7a4a', fillColor: '#1a7a4a', fillOpacity: 0.05, weight: 1.5 }} />
                  </>
                )}

                {/* Businesses */}
                {layers.businesses && (mapData.businesses || []).map(b => {
                  if (!b.coordinates?.length) return null;
                  const pos = [b.coordinates[1], b.coordinates[0]];
                  const icon = ICONS.biz[b.category] || ICONS.biz.default;
                  return (
                    <Marker key={b.id} position={pos} icon={icon}
                      eventHandlers={{ click: () => setActiveInfo({ type: 'business', data: b }) }}>
                      <Popup>
                        <div style={{ fontFamily: 'DM Sans, sans-serif', minWidth: '160px' }}>
                          <strong style={{ fontSize: '14px', display: 'block', marginBottom: '2px' }}>{b.name}</strong>
                          <div style={{ fontSize: '12px', color: '#5a7a60', textTransform: 'capitalize' }}>{b.category} · {b.location}</div>
                          {b.rating > 0 && <div style={{ marginTop: '4px', fontSize: '12px' }}>⭐ {b.rating?.toFixed(1)}</div>}
                          {b.plan === 'premium' && <span style={{ display: 'inline-block', marginTop: '4px', background: '#fef9e7', color: '#9a7d0a', fontSize: '10px', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>⭐ PREMIUM</span>}
                        </div>
                      </Popup>
                    </Marker>
                  );
                })}

                {/* Jobs */}
                {layers.jobs && (mapData.jobs || []).map(j => {
                  if (!j.coordinates?.length) return null;
                  return (
                    <Marker key={j.id} position={[j.coordinates[1], j.coordinates[0]]} icon={ICONS.job}
                      eventHandlers={{ click: () => setActiveInfo({ type: 'job', data: j }) }}>
                      <Popup>
                        <div style={{ fontFamily: 'DM Sans, sans-serif', minWidth: '160px' }}>
                          <strong style={{ fontSize: '14px', display: 'block', marginBottom: '2px' }}>💼 {j.title}</strong>
                          <div style={{ fontSize: '13px', color: '#1a7a4a', fontWeight: 700 }}>{j.pay}</div>
                          <div style={{ fontSize: '12px', color: '#5a7a60', marginTop: '2px', textTransform: 'capitalize' }}>{j.location} · {j.category}</div>
                          {j.tier === 'featured' && <span style={{ display: 'inline-block', marginTop: '4px', background: '#fef9e7', color: '#9a7d0a', fontSize: '10px', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>⭐ FEATURED</span>}
                        </div>
                      </Popup>
                    </Marker>
                  );
                })}

                {/* Emergencies */}
                {layers.emergencies && (mapData.emergencies || []).map(em => {
                  if (!em.coordinates?.length) return null;
                  const pos = [em.coordinates[1], em.coordinates[0]];
                  const icon = ICONS.emergency[em.emergencyType] || ICONS.emergency.other;
                  return (
                    <React.Fragment key={em.id}>
                      <Marker position={pos} icon={icon}
                        eventHandlers={{ click: () => setActiveInfo({ type: 'emergency', data: em }) }}>
                        <Popup>
                          <div style={{ fontFamily: 'DM Sans, sans-serif', minWidth: '160px' }}>
                            <strong style={{ fontSize: '14px', color: '#c0392b', display: 'block', marginBottom: '2px' }}>
                              🚨 {(em.emergencyType || '').replace('_', ' ').toUpperCase()}
                            </strong>
                            <div style={{ fontSize: '12px', color: '#5a7a60' }}>{em.area}</div>
                            <div style={{ fontSize: '12px', marginTop: '2px' }}>Severity: <strong style={{ color: em.severity === 'critical' ? '#c0392b' : '#e67e22' }}>{em.severity}</strong></div>
                            <div style={{ fontSize: '11px', color: '#5a7a60', marginTop: '2px', textTransform: 'capitalize' }}>Status: {em.status}</div>
                          </div>
                        </Popup>
                      </Marker>
                      <Circle center={pos} radius={350}
                        pathOptions={{ color: '#c0392b', fillColor: '#c0392b', fillOpacity: 0.08, weight: 1.5, dashArray: '5,5' }} />
                    </React.Fragment>
                  );
                })}

                {/* Reports */}
                {layers.reports && (mapData.reports || []).map(r => {
                  if (!r.coordinates?.length) return null;
                  return (
                    <Marker key={r.id} position={[r.coordinates[1], r.coordinates[0]]} icon={ICONS.report}
                      eventHandlers={{ click: () => setActiveInfo({ type: 'report', data: r }) }}>
                      <Popup>
                        <div style={{ fontFamily: 'DM Sans, sans-serif', minWidth: '150px' }}>
                          <strong style={{ fontSize: '14px', display: 'block', marginBottom: '2px', textTransform: 'capitalize' }}>
                            📢 {(r.reportType || '').replace('_', ' ')}
                          </strong>
                          <div style={{ fontSize: '12px', color: '#5a7a60' }}>{r.location}</div>
                          <div style={{ fontSize: '12px', marginTop: '2px' }}>👍 {r.upvotes} upvotes</div>
                          <div style={{ fontSize: '11px', color: r.status === 'resolved' ? '#1a7a4a' : '#e67e22', marginTop: '2px', fontWeight: 600, textTransform: 'capitalize' }}>{r.status?.replace('_', ' ')}</div>
                        </div>
                      </Popup>
                    </Marker>
                  );
                })}

                {/* Live users */}
                {layers.users && allUsers.map(u => {
                  const coords = u.coordinates || u.location?.coordinates;
                  if (!coords?.length) return null;
                  const isAdminUser = u.role === 'admin' || u.role === 'super_admin';
                  return (
                    <Marker key={u.id || u.userId}
                      position={[coords[1], coords[0]]}
                      icon={isAdminUser ? ICONS.admin : ICONS.user}
                      eventHandlers={{ click: () => setActiveInfo({ type: 'user', data: u }) }}>
                      <Popup>
                        <div style={{ fontFamily: 'DM Sans, sans-serif', minWidth: '130px' }}>
                          <strong style={{ fontSize: '14px', display: 'block', marginBottom: '2px' }}>{u.name}</strong>
                          <div style={{ fontSize: '12px', color: '#5a7a60' }}>📍 {u.area}</div>
                          {isAdminUser && (
                            <span style={{ display: 'inline-block', marginTop: '4px', background: '#e8f5ee', color: '#1a7a4a', fontSize: '10px', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>
                              {u.role === 'super_admin' ? '⭐ SUPER ADMIN' : 'ADMIN'}
                            </span>
                          )}
                        </div>
                      </Popup>
                    </Marker>
                  );
                })}
              </MapContainer>
            )}

            {/* Active info panel — slides up from bottom of map on mobile */}
            {activeInfo && (
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'white', borderRadius: 'var(--radius) var(--radius) 0 0', padding: '14px 16px', boxShadow: '0 -4px 24px rgba(0,0,0,0.15)', zIndex: 1000, borderTop: '3px solid var(--green)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {activeInfo.type === 'business' && (
                      <>
                        <div style={{ fontWeight: 700, fontSize: '15px', marginBottom: '2px' }}>{activeInfo.data.name}</div>
                        <div style={{ fontSize: '13px', color: 'var(--text-muted)', textTransform: 'capitalize' }}>{activeInfo.data.category} · {activeInfo.data.location}</div>
                        {activeInfo.data.rating > 0 && <div style={{ fontSize: '13px', marginTop: '4px', color: '#e67e22' }}>⭐ {activeInfo.data.rating?.toFixed(1)}</div>}
                      </>
                    )}
                    {activeInfo.type === 'job' && (
                      <>
                        <div style={{ fontWeight: 700, fontSize: '15px', marginBottom: '2px' }}>💼 {activeInfo.data.title}</div>
                        <div style={{ fontSize: '14px', color: 'var(--green)', fontWeight: 700 }}>{activeInfo.data.pay}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{activeInfo.data.location}</div>
                      </>
                    )}
                    {activeInfo.type === 'emergency' && (
                      <>
                        <div style={{ fontWeight: 700, fontSize: '15px', color: '#c0392b', marginBottom: '2px' }}>🚨 {(activeInfo.data.emergencyType || '').replace('_', ' ').toUpperCase()}</div>
                        <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{activeInfo.data.area} · Severity: {activeInfo.data.severity}</div>
                      </>
                    )}
                    {activeInfo.type === 'report' && (
                      <>
                        <div style={{ fontWeight: 700, fontSize: '15px', marginBottom: '2px', textTransform: 'capitalize' }}>📢 {(activeInfo.data.reportType || '').replace('_', ' ')}</div>
                        <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{activeInfo.data.location} · 👍 {activeInfo.data.upvotes}</div>
                      </>
                    )}
                    {activeInfo.type === 'user' && (
                      <>
                        <div style={{ fontWeight: 700, fontSize: '15px', marginBottom: '2px' }}>{activeInfo.data.name}</div>
                        <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>📍 {activeInfo.data.area}</div>
                        {(activeInfo.data.role === 'admin' || activeInfo.data.role === 'super_admin') && (
                          <span className="badge badge-green" style={{ marginTop: '4px', display: 'inline-block' }}>ADMIN</span>
                        )}
                      </>
                    )}
                  </div>
                  <button onClick={() => setActiveInfo(null)}
                    style={{ background: 'var(--bg)', border: 'none', width: 28, height: 28, borderRadius: '50%', cursor: 'pointer', fontSize: '14px', color: 'var(--text-muted)', flexShrink: 0, marginLeft: '8px' }}>
                    ✕
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Side panel — desktop only */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {/* Legend */}
            <div className="card card-pad">
              <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '14px', marginBottom: '10px' }}>🗺️ Map Legend</div>
              {[
                { icon: '📍', label: 'Your Location',   color: '#c0392b' },
                { icon: '🏪', label: 'Businesses',       color: '#1a7a4a' },
                { icon: '💼', label: 'Job Listings',     color: '#1a5fa8' },
                { icon: '🚨', label: 'Emergency Alerts', color: '#c0392b' },
                { icon: '📢', label: 'Community Reports',color: '#e67e22' },
                { icon: '👥', label: 'Community Members',color: '#6c3483' },
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 0', borderBottom: '1px solid var(--border)', fontSize: '13px' }}>
                  <span style={{ fontSize: '16px' }}>{item.icon}</span>
                  <span style={{ flex: 1 }}>{item.label}</span>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: item.color, flexShrink: 0 }} />
                </div>
              ))}
            </div>

            {/* Stats */}
            <div className="card card-pad">
              <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '14px', marginBottom: '10px' }}>📊 Area Stats</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {[
                  { label: 'Businesses', value: (mapData.businesses || []).length, color: '#1a7a4a' },
                  { label: 'Open Jobs',  value: (mapData.jobs || []).length,       color: '#1a5fa8' },
                  { label: 'Alerts',     value: (mapData.emergencies || []).length, color: '#c0392b' },
                  { label: 'Reports',    value: (mapData.reports || []).length,     color: '#e67e22' },
                ].map(s => (
                  <div key={s.label} style={{ background: 'var(--bg)', borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
                    <div style={{ fontSize: '22px', fontWeight: 800, color: s.color, fontFamily: 'Syne, sans-serif', lineHeight: 1 }}>{s.value}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Active emergencies */}
            {(mapData.emergencies || []).length > 0 && (
              <div className="card card-pad" style={{ borderLeft: '3px solid var(--red)' }}>
                <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '13px', color: 'var(--red)', marginBottom: '8px' }}>🚨 Active Alerts</div>
                {(mapData.emergencies || []).slice(0, 4).map(em => (
                  <div key={em.id} style={{ padding: '6px 0', borderBottom: '1px solid var(--red-light)', fontSize: '12px' }}>
                    <strong style={{ textTransform: 'uppercase' }}>{(em.emergencyType || '').replace('_', ' ')}</strong> — {em.area}
                    <div style={{ color: 'var(--text-muted)', textTransform: 'capitalize' }}>{em.status} · {em.severity}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Location sharing card */}
            <div style={{ background: sharing ? 'var(--green-light)' : 'var(--bg)', border: `1px solid ${sharing ? '#1a7a4a' : 'var(--border)'}`, borderRadius: 'var(--radius)', padding: '12px', fontSize: '13px' }}>
              <div style={{ fontWeight: 600, marginBottom: '4px', color: sharing ? '#1a7a4a' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                {sharing
                  ? <><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#1a7a4a', display: 'inline-block', animation: 'pulse 1.4s infinite' }}></span>Location Sharing: ON</>
                  : <>📍 Location Sharing: OFF</>
                }
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                {sharing
                  ? 'Community admins can see your location to assist in emergencies.'
                  : 'Enable to appear on the map and help admins locate you in emergencies.'}
              </p>
              <button onClick={toggleSharing}
                className={`btn btn-sm ${sharing ? 'btn-danger' : 'btn-secondary'}`}
                style={{ marginTop: '8px', width: '100%' }}>
                {sharing ? 'Stop Sharing' : 'Share My Location'}
              </button>
            </div>
          </div>

        </div>

        {/* Mobile stats bar — shown below map on small screens */}
        <style>{`@media(min-width:900px){.mobile-stats{display:none!important}}`}</style>
        <div className="mobile-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
          {[
            { label: 'Shops',   value: (mapData.businesses || []).length, color: '#1a7a4a', icon: '🏪' },
            { label: 'Jobs',    value: (mapData.jobs || []).length,        color: '#1a5fa8', icon: '💼' },
            { label: 'Alerts',  value: (mapData.emergencies || []).length, color: '#c0392b', icon: '🚨' },
            { label: 'Reports', value: (mapData.reports || []).length,     color: '#e67e22', icon: '📢' },
          ].map(s => (
            <div key={s.label} style={{ background: 'white', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', padding: '10px 6px', textAlign: 'center', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ fontSize: '16px', marginBottom: '2px' }}>{s.icon}</div>
              <div style={{ fontSize: '18px', fontWeight: 800, color: s.color, fontFamily: 'Syne, sans-serif', lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
