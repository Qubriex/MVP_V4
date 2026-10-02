// src/components/PageTransition.js
// Wraps the route tree so moving between areas gets a smooth fade. Portal
// areas with a shared shell (/institution, /learn, /employer, /admin) are keyed
// by area, not by full path: the shell (sidebar, signed-in staff, alerts)
// stays mounted, and only the page inside it fades (see ln-main in the
// layouts). Keying on the full path remounted the whole shell on every click,
// which made the sidebar and headings flicker.
import React from 'react';
import { useLocation } from 'react-router-dom';

export default function PageTransition({ children }) {
  const location = useLocation();
  const area = location.pathname.split('/')[1] || '';
  const key = ['institution', 'learn', 'employer', 'admin'].includes(area) && !/^\/learn\/session/.test(location.pathname) ? area : location.pathname;
  return (
    <div key={key} className="page-fade">
      {children}
    </div>
  );
}
