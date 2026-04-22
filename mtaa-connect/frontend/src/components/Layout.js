import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import BottomNav from './BottomNav';
import EmergencyModal from './EmergencyModal';

export default function Layout() {
  const [showEmergency, setShowEmergency] = useState(false);
  return (
    <>
      <Navbar onEmergency={() => setShowEmergency(true)} />
      <Outlet />
      <BottomNav />
      {showEmergency && <EmergencyModal onClose={() => setShowEmergency(false)} />}
    </>
  );
}
