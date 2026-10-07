// src/pages/employer/Layout.js — shell for /employer/*. Loads the company and
// the signed-in user once (GET /employer/me) and shares them with the pages.
import React, { useCallback, useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Home, Building2, Users, KeyRound, BadgeCheck } from 'lucide-react';
import api from '../../utils/api';
import PortalLayout from '../../components/PortalLayout';

export const useEmployer = () => useOutletContext();
export const KYB_TEXT = { pending: ['Verification pending', 'ln-tag-warning'], verified: ['Verified company', 'ln-tag-success'], rejected: ['Rejected', 'ln-tag-neutral'], suspended: ['Suspended', 'ln-tag-neutral'] };

export default function EmployerLayout() {
  const [me, setMe] = useState(null);
  const refresh = useCallback(() => api.get('/employer/me').then(r => setMe(r.data)).catch(() => {}), []);
  useEffect(() => { refresh(); }, [refresh]);
  const steps = me?.employer?.kyb_steps;
  const todo = steps ? [steps.details, steps.domain_verified, steps.approved].filter(x => !x).length : 0;
  const items = [
    { to: '/employer/home', label: 'Home', icon: Home, badge: todo || null },
    { to: '/employer/company', label: 'Company', icon: Building2 },
    { to: '/employer/team', label: 'Team', icon: Users },
    { to: '/employer/api-keys', label: 'API & integrations', icon: KeyRound },
    { to: '/verify', label: 'Verify a credential', icon: BadgeCheck }
  ];
  return (
    <PortalLayout kicker="FOR EMPLOYERS" loginPath="/employer/login" items={items} side="employer"
      org={<><b style={{ fontWeight: 600 }}>{me?.employer?.name || 'Your company'}</b>{me?.employer?.domain && <span>@{me.employer.domain}</span>}</>}
      account={{ primary: me?.user?.name || me?.user?.email, secondary: me?.user?.role }}
      context={{ me, refresh, isOwner: me?.user?.role === 'owner' }} />
  );
}
