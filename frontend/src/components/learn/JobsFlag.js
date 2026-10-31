// src/components/learn/JobsFlag.js — the job market and emerging topics open
// only when the learner_jobs switch is on; otherwise their links go Home.
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useFeatures } from '../../utils/features';

export default function JobsFlag({ children }) {
  const f = useFeatures();
  if (f.loading) return null;
  return f.learner_jobs ? children : <Navigate to="/learn/dashboard" replace />;
}
