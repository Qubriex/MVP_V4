// src/pages/employer/Layout.js — shell for /employer/*. Loads the company and
// the signed-in user once (GET /employer/me) and shares them with the pages.
import { useUiLang } from '../../context/UiLangContext';
import React, { useCallback, useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Home, Building2, Users, KeyRound, BadgeCheck, Briefcase, ListChecks, School, Handshake, FileCheck2, ClipboardList, Receipt } from 'lucide-react';
import api from '../../utils/api';
import PortalLayout from '../../components/PortalLayout';

export const useEmployer = () => useOutletContext();
export const KYB_TEXT = { pending: ['emp.layout.kybText.verificationPending', 'ln-tag-warning'], verified: ['emp.layout.kybText.verifiedCompany', 'ln-tag-success'], rejected: ['emp.layout.kybText.rejected', 'ln-tag-neutral'], suspended: ['emp.layout.kybText.suspended', 'ln-tag-neutral'] };

export default function EmployerLayout() {
  const { t } = useUiLang();
  const [me, setMe] = useState(null);
  const refresh = useCallback(() => api.get('/employer/me').then(r => setMe(r.data)).catch(() => {}), []);
  useEffect(() => { refresh(); }, [refresh]);
  const steps = me?.employer?.kyb_steps;
  const todo = steps ? [steps.details, steps.domain_verified, steps.approved].filter(x => !x).length : 0;
  const items = [
    { to: '/employer/home', label: t('nav.homeShort'), icon: Home, badge: todo || null },
    { to: '/employer/roles', label: t('emp.nav.roles'), icon: Briefcase },
    { to: '/employer/pipeline', label: t('emp.nav.pipeline'), icon: ListChecks },
    { to: '/employer/colleges', label: t('emp.nav.colleges'), icon: School },
    { to: '/employer/sponsor', label: t('emp.nav.sponsor'), icon: Handshake },
    { to: '/employer/templates', label: t('emp.nav.templates'), icon: ClipboardList },
    { to: '/employer/verify-bulk', label: t('emp.nav.bulk'), icon: FileCheck2 },
    { to: '/employer/company', label: t('emp.nav.company'), icon: Building2 },
    { to: '/employer/team', label: t('emp.nav.team'), icon: Users },
    { to: '/employer/api-keys', label: t('emp.nav.api'), icon: KeyRound },
    { to: '/employer/billing', label: t('emp.nav.billing'), icon: Receipt },
    { to: '/verify', label: t('emp.nav.verify'), icon: BadgeCheck }
  ];
  return (
    <PortalLayout kicker={'FOR EMPLOYERS'} loginPath="/employer/login" items={items} side="employer"
      org={<><b style={{ fontWeight: 600 }}>{me?.employer?.name || t('emp.layout.yourCompany')}</b>{me?.employer?.domain && <span>@{me.employer.domain}</span>}</>}
      account={{ primary: me?.user?.name || me?.user?.email, secondary: me?.user?.role }}
      context={{ me, refresh, isOwner: me?.user?.role === 'owner' }} />
  );
}
