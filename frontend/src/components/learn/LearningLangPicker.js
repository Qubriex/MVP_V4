// src/components/learn/LearningLangPicker.js — "Learning in: తెలుగు ▾" on
// every learning screen (lessons, concept notes, practice, reviews, topic
// intros, Ask Qubirex). Changing it here changes it everywhere.
import React from 'react';
import { Languages } from 'lucide-react';
import { useUiLang } from '../../context/UiLangContext';
import { useLearningLanguage, LEARNING_LANGUAGES } from '../../utils/learningLanguage';

export const LEARNING_LABEL = { telugu: 'తెలుగు', hindi: 'हिंदी', english: 'English', telugu_en: 'తెలుగు + English', hindi_en: 'हिंदी + English' };
// One line in each mode, so the difference is clear before choosing: full
// Telugu / Hindi keeps English only for code; the mix keeps English words.
export const LEARNING_SAMPLE = {
  telugu: 'ఈ ఫంక్షన్ ఒక విలువను return చేస్తుంది.',
  telugu_en: 'ఈ function ఒక value ని return చేస్తుంది.',
  hindi: 'यह फ़ंक्शन एक वैल्यू return करता है।',
  hindi_en: 'यह function एक value return करता है।',
  english: 'This function returns a value.'
};

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
        {LEARNING_LANGUAGES.map(v => <option key={v} value={v} data-sample={LEARNING_SAMPLE[v]}>{LEARNING_LABEL[v]} — “{LEARNING_SAMPLE[v]}”</option>)}
      </select>
    </label>
  );
}
