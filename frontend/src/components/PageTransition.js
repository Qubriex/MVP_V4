// src/components/PageTransition.js
// Wraps the route tree so every navigation gets a smooth fade instead of a
// hard cut. Keying on the pathname is enough — React Router already mounts
// a fresh component per distinct path, this just animates that mount.
import React from 'react';
import { useLocation } from 'react-router-dom';

export default function PageTransition({ children }) {
  const location = useLocation();
  return (
    <div key={location.pathname} className="page-fade">
      {children}
    </div>
  );
}
