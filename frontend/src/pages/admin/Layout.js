// src/pages/admin/Layout.js — shell for /admin/*.
import { useUiLang } from '../../context/UiLangContext';
import React, { useEffect, useState } from 'react';
import { LayoutDashboard, Building, Network, Gauge } from 'lucide-react';
import api from '../../utils/api';
import PortalLayout from '../../components/PortalLayout';

export default function AdminLayout() {
  const { t } = useUiLang();
  const [counts, setCounts] = useState({});
  useEffect(() => {
    api.get('/admin/employers?status=pending').then(r => setCounts(c => ({ ...c, kyb: r.data.employers.length }))).catch(() => {});
    api.get('/admin/ontology-review').then(r => setCounts(c => ({ ...c, onto: r.data.counts.pending || 0 }))).catch(() => {});
  }, []);
  const email = (() => { try { return JSON.parse(localStorage.getItem('qubirex_user') || '{}').email; } catch { return ''; } })();
  const items = [
    { to: '/admin/overview', label: t('adm.nav.overview'), icon: LayoutDashboard },
    { to: '/admin/employers', label: t('adm.nav.kyb'), icon: Building, badge: counts.kyb || null },
    { to: '/admin/ontology', label: t('adm.nav.ontology'), icon: Network, badge: counts.onto || null },
    { to: '/admin/quality', label: t('adm.nav.quality'), icon: Gauge }
  ];
  return <PortalLayout kicker="PLATFORM ADMIN" loginPath="/admin/login" items={items} account={{ primary: email, secondary: 'Admin' }} />;
}
