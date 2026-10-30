// src/utils/features.js — switches the server turns on or off for learners
// (GET /learner/features), e.g. learner_jobs: the job market and emerging
// topics (FEATURE_LEARNER_JOBS, off by default). Read once per visit.
import { useEffect, useState } from 'react';
import api from './api';

let current = null;
let loading = null;
const listeners = new Set();

export function useFeatures() {
  const [value, setValue] = useState(current || { learner_jobs: false, loading: true });
  useEffect(() => {
    listeners.add(setValue);
    if (!current && !loading) {
      loading = api.get('/learner/features').then(r => { current = r.data; listeners.forEach(fn => fn(current)); }).catch(() => { current = { learner_jobs: false }; listeners.forEach(fn => fn(current)); });
    } else if (current) setValue(current);
    return () => { listeners.delete(setValue); };
  }, []);
  return value;
}
