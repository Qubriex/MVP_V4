// src/utils/learningLanguage.js — the learner's learning language: the
// language lessons, notes, practice, reviews and audio intros come in
// (separate from the screen language of menus and buttons). One value per
// visit, shared by every screen; changing it on any screen changes it everywhere.
import { useEffect, useState } from 'react';
import api from './api';

export const LEARNING_LANGUAGES = ['telugu', 'hindi', 'english', 'telugu_en', 'hindi_en'];
let current = null;
let loading = null;
const listeners = new Set();
const announce = () => listeners.forEach(fn => fn(current));

function load() {
  if (!loading) loading = api.get('/learner/learning-language').then(r => { current = r.data.value; announce(); }).catch(() => { loading = null; });
  return loading;
}

export async function setLearningLanguage(value) {
  const r = await api.put('/learner/learning-language', { value });
  current = r.data.value;
  announce();
  return current;
}

/** The speech tag for the main language of a learning language. */
export const learningSpeechTag = (v) => (String(v).startsWith('hindi') ? 'hi-IN' : v === 'english' ? 'en-IN' : 'te-IN');

/** [value, setValue]; value is null until loaded. enabled=false (staff, employers) never asks the learner API. */
export function useLearningLanguage(enabled = true) {
  const [value, setValue] = useState(enabled ? current : null);
  useEffect(() => {
    if (!enabled) return undefined;
    listeners.add(setValue);
    if (current == null) load(); else setValue(current);
    return () => { listeners.delete(setValue); };
  }, [enabled]);
  return [value, setLearningLanguage];
}
