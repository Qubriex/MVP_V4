// src/components/learn/LearningLangPicker.js — "Learning in: తెలుగు ▾" on
// every learning screen (lessons, concept notes, practice, reviews, topic
// intros, Ask Qubirex). Changing it here changes it everywhere.
import React from 'react';
import { Languages } from 'lucide-react';
import { useUiLang } from '../../context/UiLangContext';
import { useLearningLanguage, LEARNING_LANGUAGES } from '../../utils/learningLanguage';

export const LEARNING_LABEL = { telugu: 'తెలుగు', hindi: 'हिंदी', english: 'English', telugu_en: 'తెలుగు + English', hindi_en: 'हिंदी + English' };

export default function LearningLangPicker({ onChange, compact = false }) {
  const { t } = useUiLang();
  const [value, set] = useLearningLanguage();
  if (!value) return null;
  const change = async (e) => { const v = await set(e.target.value); onChange?.(v); };
  return (
    <label className={`lj-langpick ${compact ? 'is-compact' : ''}`} data-learning-language={value}>
      <Languages size={14} aria-hidden="true" />
      <span className="ln-xs">{t('lang.learningIn')}</span>
      <select value={value} onChange={change} aria-label={t('lang.learningLanguage')}>
        {LEARNING_LANGUAGES.map(v => <option key={v} value={v}>{LEARNING_LABEL[v]}</option>)}
      </select>
    </label>
  );
}
