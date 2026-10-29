// core/sampleLesson.js — the home page's "Hear a sample lesson" text, spoken
// in Professor Qubirex's teaching voice. scripts/record-sample-lesson.js
// records it to static files at build time; GET /api/sample-lesson speaks it
// live only when no recording was shipped.
export const SAMPLE_LESSON = {
  telugu: 'React లో component అంటే ఒక చిన్న భాగం. ఒక బటన్ గురించి ఆలోచించండి — ఒకసారి రాస్తే, ఎక్కడైనా వాడొచ్చు. ఇప్పుడు మీరే ఒకటి రాయండి.',
  hindi: 'React में component एक छोटा हिस्सा है। एक बटन के बारे में सोचिए — एक बार लिखो, कहीं भी इस्तेमाल करो। अब आप ख़ुद एक लिखिए।'
};
