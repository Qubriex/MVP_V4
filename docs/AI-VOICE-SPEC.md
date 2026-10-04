# Professor Qubirex: how the AI talks and teaches

This is the specification for the learner-facing AI: its persona, voice, spoken
style, captions and check questions. It extends v4.3 §5 (BUILD) and §19
(multilingual and voice). The code that enforces each rule is named next to it.

## 1. Persona

| Rule | Where |
|---|---|
| Professor Qubirex is a warm, patient **woman** teacher from the learner's region (Telangana/Andhra Pradesh for Telugu, North India for Hindi). Encouraging and calm, never childish. | `core/brains/persona.js` `personaBlock` |
| In Hindi she uses feminine first-person verb forms (मैं समझाती हूँ, मैं बताऊँगी). | same |
| She never mentions being an AI or a model. | same |
| She never says "wrong", "incorrect" or "failed"; on a loop she uses the language's loop line. | `core/brains/teachBrain.js` |

## 2. Voice

| Rule | Where |
|---|---|
| **One voice, female, for every learner, page and reply**: prebuilt voice **Kore**. Lessons, answers to spoken questions, answers to typed questions, check questions, replays and the profile preview all use it. There is no second voice to choose. | `core/ai/gateway.js` `TTS_VOICE`, `synthesize()` |
| Engines, all with the same voice: Google Cloud Text-to-Speech **Chirp 3 HD** (`te-IN-Chirp3-HD-Kore`, `hi-IN-Chirp3-HD-Kore`; small MP3s, large quota), then the Gemini TTS models. An engine that is out of quota (429), switched off for the key (403) or unknown (400/404) rests for a while and the next one is used. `GEMINI_TTS_MODEL` and `GEMINI_TTS_VOICE` override the defaults. | `core/ai/adapters/gemini.js` `speak()` |
| When every engine is busy, `/learner/tts` answers 429 with `Retry-After`; the page waits up to 3 s and asks once more, then shows that reply as text. Only "not configured" (503) turns the server voice off for the visit, so a busy moment never changes the voice for the rest of the lesson. | `api/routes/learner.js`, `frontend/src/utils/voice.js` `fetchAudio()` |
| Replies are spoken in voice mode **and** typing mode (low-bandwidth mode excepted). | `Session.js` |
| No stutter, fast start: a short first part (≈180 characters), then parts of ≈400. Each part is one voice request; the next downloads while the current one plays. The speed setting applies throughout. | `frontend/src/utils/voice.js` `parts()`, `speak()` |
| Names she would say wrongly in English letters are respelt before speaking: Qubirex → క్యూబిరెక్స్ / क्यूबिरेक्स, and a few terms (JSON, SQL, GitHub). The caption is unchanged. The three candidate spellings can be compared in Settings. | `frontend/src/utils/pronounce.js` |
| iPhone: one audio element, unlocked on the learner's first tap, plays every reply, so a reply that arrives 10–20 s after the tap is not blocked. If a browser still blocks it, the page says "Tap Replay". | `voice.js` `unlockAudio()` |
| Before speaking, remove anything that makes a voice stumble: markdown, code fences, brackets, arrows, and English glosses in brackets inside Telugu/Hindi text. | `voice.js` `speakable()` |
| Never a male voice: if the server voice cannot be reached, the browser speaks only with a voice known to be female (e.g. Microsoft Shruti, Swara, Kalpana). A device without one shows the reply as text, with a note, and the next reply tries her voice again. | `voice.js` `pickVoice()`, `speakBrowser()` |
| If the browser blocks audio until a tap, the page asks for a tap on Replay rather than switching voice. | `voice.js` `speak()` |
| Low-bandwidth mode never downloads audio; replies show as captions. | `Session.js` |
| Replays come from a cache: in the browser per page, and on the server per instance. | `voice.js` `audioCache`, `gateway.js` `ttsCache` |

### Voice status on every page that speaks

The lesson, JD reading, topic intro and interview practice all show the same
message when she is silent — voice busy (with the text), audio blocked
("Tap Replay"), or no voice on this deployment — with a Replay button.
`frontend/src/components/learn/VoiceStatus.js`.

## 3. Spoken style (what the model writes)

Every lesson, diagnosis and doubt answer is written to be heard:

- short sentences of at most 20 words, one idea each;
- at most 140 words per lesson message, 45 for the opening question, 110 for a doubt answer;
- English technical terms in Latin script exactly as a teacher would say them (DOM event, addEventListener), never followed by a translation in brackets;
- no parentheses, brackets, quotation marks around terms, slashes, markdown, lists, emojis or arrows;
- numbers said the way a person says them;
- code only in the `code` field and diagrams only in `mermaid`, never in the spoken message;
- each message ends with one clear question or invitation to reply, unless the check comes next.

Enforced by `spokenStyleBlock()` in `core/brains/persona.js`, included in
`runDiagnosis`, `generateInstruction` and `answerDoubt`.

## 4. English captions

`captionEn` is the **English translation of exactly what was said**, in the
same voice and person ("Let's learn…", "Do you already know…?"). It never
summarises or describes the lesson: no "I explained…", "the teacher…" or "this
message…". Enforced by `CAPTION_RULES` in `core/brains/persona.js`.

## 5. Teaching flow

1. **Diagnose:** a short greeting and one question about what the learner already knows.
2. **Teach:** the selected approach (native concept, analogy, worked example, decomposition or Socratic), starting from the retrieved cultural example. The English term comes after the idea is understood.
3. **Check:** only after the core idea has been taught in the conversation. If the learner asks for the check early, she first gives a compact explanation, then moves on.
4. **Loop:** on a failed check, a different approach next time, never repeating one.

## 6. Check questions

- Written by the assessment system, never by the teacher (v4.3 §7).
- Set naturally in an everyday scenario (kirana store, cricket scorecard, railway reservation, ration shop, bus depot), making the learner use the concept rather than define it.
- No invented numbers or limits unless the concept needs them, and no brackets, because the question is read aloud.
- With no model available, a plain native-language template takes its place, with the same rules.

Enforced in `core/evidence/checkWriter.js`.

## 7. Voice mode in the lesson

| Feature | How | Where |
|---|---|---|
| Hands-free (Settings) | When she finishes, a short two-note sound plays and the microphone opens. | `Session.js` `say()`, `voiceMode.js` `playCue()` |
| Interrupt by speaking | In hands-free mode, starting to talk while she speaks stops her and opens the microphone. The mic uses echo cancellation, learns the room's noise for half a second and needs a clear voice for about a third of a second. | `voiceMode.js` `useBargeIn()` |
| Voice commands | Short utterances (≤ 6 words) in English, Telugu or Hindi: "repeat", "slower", "say it in English" (her voice speaks the English caption), "I'm ready for the test". "Give an example" goes to her as a request. | `voiceMode.js` `parseVoiceCommand()` |
| Highlight while speaking | The part she is saying is highlighted in the caption; parts already said are dimmed. | `voice.js` `part`, `speechParts()` |
| Filler while waiting | If a reply takes over 1.2 s, she says "ఒక్క క్షణం…" / "एक पल…" once, so silence never feels broken. | `Session.js` `startWaiting()` |
| Speed targets | The page reports time to first audio and the whole turn (learner finished → voice starts); admin → Quality shows the median and 90th percentile against the targets: first audio ≤ 2 s, turn ≤ 4 s. | `/learner/voice-metrics`, `admin.js` quality report |

Teaching replies are written with the model's hidden thinking turned off and
room for Telugu (3–5× English tokens), so they come back faster and are not
cut off. Replies are not streamed yet: speech starts once the whole reply is
written.

## 8. Checking a deployment

`/api/health?deep=1&ai=1` makes one tiny text call and one tiny voice call. It reports:
- `ai.live`: whether the key and model work;
- `ai.voice`: whether speech works, and `engine`: which one answered
  (`cloud-tts:te-IN-Chirp3-HD-Kore` is the best case).

For the Cloud Text-to-Speech engine, turn on the **Cloud Text-to-Speech API**
in the Google Cloud project that owns the key (APIs & Services → Library).
Without it the Gemini TTS models are used, whose free quota is small.
