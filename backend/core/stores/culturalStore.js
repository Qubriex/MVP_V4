// core/stores/culturalStore.js — CULT brain's store: the Cultural Knowledge Base (CKB)
// Tables: cultural_knowledge_base, cultural_usage_log
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../../db/init');

const ALPHA = 0.3; // exponential moving average weight — recent outcomes matter more

function initCulturalSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS cultural_knowledge_base (
      id TEXT PRIMARY KEY,
      concept_tag TEXT NOT NULL,
      language TEXT NOT NULL CHECK(language IN ('telugu','hindi')),
      region TEXT NOT NULL,
      vocabulary_level TEXT DEFAULT 'beginner',
      entry_point TEXT NOT NULL,
      explanation_text TEXT,
      effectiveness_score REAL DEFAULT 0.75,
      advance_count INTEGER DEFAULT 0,
      loop_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS cultural_usage_log (
      id TEXT PRIMARY KEY,
      ckb_entry_id TEXT NOT NULL,
      learner_id TEXT,
      session_id TEXT,
      node_id TEXT,
      outcome TEXT CHECK(outcome IN ('ADVANCE','LOOP')),
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
}

// ─── CKB seed data — current entries (doc section 4.6) ────────────────────────
// vocabulary_level defaults to 'beginner' for all seed rows; the store falls
// back across vocabulary_level/region before falling back across language.
const SEED_EXAMPLES = [
  { tag: 'variables', language: 'telugu', region: 'telangana', entry: 'Vantintlo labelled dabbalu (Kitchen labelled containers)', text: 'Each container in the kitchen has a label and holds one kind of thing — a variable is a labelled container that holds one value at a time.', eff: 0.87 },
  { tag: 'variables', language: 'hindi', region: 'north_india', entry: 'Dabbe aur labels', text: 'Ghar ke dabbon par label lage hote hain — ek variable bhi ek labelled dabba hai jisme ek value rakhi jaati hai.', eff: 0.83 },
  { tag: 'loops', language: 'telugu', region: 'telangana', entry: 'Class attendance lo peru cheppinattlu (Attendance taking)', text: 'Teacher goes down the roll one name at a time until the list ends — that repetition, one step per name, is a loop.', eff: 0.91 },
  { tag: 'loops', language: 'hindi', region: 'north_india', entry: 'Attendance lena', text: 'Roll number se roll number tak, ek-ek naam bulaya jaata hai jab tak list khatam na ho — yही ek loop hai.', eff: 0.85 },
  { tag: 'functions', language: 'telugu', region: 'telangana', entry: 'Tea chesedeppudu — same steps, different quantities', text: 'The same tea-making steps run every time, only the quantity of tea/milk/sugar changes — a function is those same steps run with different inputs.', eff: 0.88 },
  { tag: 'functions', language: 'hindi', region: 'north_india', entry: 'Chai banana — same steps, alag quantities', text: 'Chai banane ke steps hamesha same rehte hain, sirf matra badalti hai — function bhi wahi steps alag inputs ke saath chalata hai.', eff: 0.86 },
  { tag: 'conditionals', language: 'telugu', region: 'telangana', entry: 'Veliyaadaniki vaanapada chusukodaniki (Checking for rain before leaving)', text: 'Before stepping out you check the sky — if it looks like rain, take an umbrella, else don\'t. That check-then-branch is a conditional.', eff: 0.89 },
  { tag: 'conditionals', language: 'hindi', region: 'north_india', entry: 'Baarish dekh ke decide karo', text: 'Bahar nikalne se pehle aasman dekhte hain — baarish ho to chhata lo, warna mat lo. Yahi check-aur-faisla conditional hai.', eff: 0.84 },
  { tag: 'lists', language: 'telugu', region: 'telangana', entry: 'Shopping list (market list)', text: 'A market list holds several items in one ordered place — a list stores many values together, in order.', eff: 0.92 },
  { tag: 'lists', language: 'hindi', region: 'north_india', entry: 'Sabzi ki list', text: 'Sabzi ki list mein saare items ek order mein likhe hote hain — list bhi values ko waise hi ek saath, order mein rakhti hai.', eff: 0.90 },
  { tag: 'dictionaries', language: 'telugu', region: 'telangana', entry: 'Phone lo contacts', text: 'Every contact name maps to one phone number — a dictionary maps a key to a value the same way.', eff: 0.88 },
  { tag: 'classes', language: 'telugu', region: 'telangana', entry: 'Student form template', text: 'A blank student form has fields to be filled per student — a class is that template, and each filled form is an object.', eff: 0.85 },
  { tag: 'sql_select', language: 'telugu', region: 'telangana', entry: 'Library book register', text: 'Asking the librarian "show me books by this author" is a SELECT — you filter a register down to the rows you need.', eff: 0.87 },
  { tag: 'git', language: 'telugu', region: 'telangana', entry: 'Exam notes versions', text: 'Keeping "notes_v1", "notes_v2" copies of exam notes so nothing is lost is what Git commits do for code.', eff: 0.83 },
  { tag: 'inheritance', language: 'telugu', region: 'telangana', entry: 'Amma ki cooking skills kids ki vasthundi', text: 'A child inherits the mother\'s cooking skills as a base and adds their own touches — a subclass inherits a parent class the same way.', eff: 0.84 },
  { tag: 'inheritance', language: 'hindi', region: 'north_india', entry: 'Baap ki dukaan beta sambhalta hai', text: 'Beta baap ki dukaan ka tarika seekh kar sambhalta hai, phir apna bhi jodta hai — inheritance mein bhi subclass parent se leta hai aur apna jodta hai.', eff: 0.81 },
  { tag: 'error_handling', language: 'telugu', region: 'telangana', entry: 'ATM lo paise lekunappudu', text: 'When the ATM has no cash it shows a message instead of crashing — error handling catches the problem and responds gracefully instead of failing silently.', eff: 0.88 },
  { tag: 'recursion', language: 'telugu', region: 'telangana', entry: 'Mirror lo mirror chusukunnattlu', text: 'Two facing mirrors reflect the same reflection inside itself, smaller each time, until it becomes too small to see — a function calling itself, with a stopping point, is recursion.', eff: 0.79 },
  { tag: 'api_json', language: 'hindi', region: 'north_india', entry: 'Restaurant mein waiter se order lena', text: 'Waiter aapka order (request) le jaata hai aur kitchen se plate (response) laata hai, ek fixed format mein — API/JSON bhi waisa hi structured request-response hai.', eff: 0.86 },
  { tag: 'git_branching', language: 'hindi', region: 'north_india', entry: 'Exam ki alag copy mein practice karna', text: 'Asli notes ko chhede bina ek alag copy mein practice karna, phir accha laga to wapas asli mein jodna — yahi Git branch aur merge hai.', eff: 0.83 },
  // Coverage gaps flagged for closure before launch (doc section 13.4)
  { tag: 'sql_joins', language: 'telugu', region: 'telangana', entry: 'Rెండు registers ni ఒకటిగా కలపడం (Merging two registers by roll number)', text: 'Matching the attendance register to the marks register by roll number to see both together is a JOIN — combining two tables on a common column.', eff: 0.80 },
  { tag: 'strings', language: 'telugu', region: 'telangana', entry: 'Pేరు spelling letter by letter', text: 'A name is a sequence of letters in order — a string is text handled as an ordered sequence of characters.', eff: 0.80 },
  { tag: 'modules_imports', language: 'telugu', region: 'telangana', entry: 'Vంటintlo ready-made masala పొడులు వాడటం (using ready-made spice mixes instead of grinding from scratch)', text: 'Instead of making everything from scratch, you bring in a ready-made spice mix someone else prepared — importing a module brings in code someone else already wrote.', eff: 0.80 },
  { tag: 'file_io', language: 'telugu', region: 'telangana', entry: 'Note book లో రాయడం, తర్వాత తెరిచి చదవడం (writing in a notebook, then opening it later to read)', text: 'You write something in a notebook and it stays there until you open and read it again later — file I/O writes data that outlives the program and reads it back.', eff: 0.80 },
  { tag: 'algorithms', language: 'telugu', region: 'telangana', entry: 'వంట రెసిపీ steps వరుసగా పాటించడం (following a recipe\'s steps in order)', text: 'A recipe is a precise, ordered set of steps that reliably produces the same dish — an algorithm is that same idea for solving a problem.', eff: 0.80 }
];

function seedInitialExamples(db) {
  const count = db.prepare('SELECT COUNT(*) as cnt FROM cultural_knowledge_base').get().cnt;
  if (count > 0) return; // already seeded

  const insert = db.prepare(`
    INSERT INTO cultural_knowledge_base (id, concept_tag, language, region, vocabulary_level, entry_point, explanation_text, effectiveness_score)
    VALUES (?, ?, ?, ?, 'beginner', ?, ?, ?)
  `);
  const insertMany = db.transaction((rows) => rows.forEach(r =>
    insert.run(uuidv4(), r.tag, r.language, r.region, r.entry, r.text, r.eff)
  ));
  insertMany(SEED_EXAMPLES);
}

// ─── Three-tier fallback retrieval ────────────────────────────────────────────
// Tier 1 (exact): concept_tag + language + region + vocabulary_level
// Tier 2 (relax region): concept_tag + language + vocabulary_level
// Tier 3 (relax all): concept_tag + language only
function retrieveByConceptTag(conceptTag, language, region, vocabularyLevel) {
  const db = getDb();

  let rows = db.prepare(`
    SELECT * FROM cultural_knowledge_base
    WHERE concept_tag = ? AND language = ? AND region = ? AND vocabulary_level = ?
    ORDER BY effectiveness_score DESC LIMIT 3
  `).all(conceptTag, language, region, vocabularyLevel);

  if (rows.length === 0) {
    rows = db.prepare(`
      SELECT * FROM cultural_knowledge_base
      WHERE concept_tag = ? AND language = ? AND vocabulary_level = ?
      ORDER BY effectiveness_score DESC LIMIT 3
    `).all(conceptTag, language, vocabularyLevel);
  }

  if (rows.length === 0) {
    rows = db.prepare(`
      SELECT * FROM cultural_knowledge_base
      WHERE concept_tag = ? AND language = ?
      ORDER BY effectiveness_score DESC LIMIT 3
    `).all(conceptTag, language);
  }

  db.close();
  return rows;
}

// ─── Effectiveness scoring — exponential moving average ──────────────────────
function logOutcome(ckbEntryId, learnerId, sessionId, nodeId, outcome) {
  const db = getDb();
  db.prepare(`
    INSERT INTO cultural_usage_log (id, ckb_entry_id, learner_id, session_id, node_id, outcome)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(uuidv4(), ckbEntryId, learnerId, sessionId, nodeId, outcome);

  const entry = db.prepare('SELECT * FROM cultural_knowledge_base WHERE id = ?').get(ckbEntryId);
  if (entry) {
    const newEffectiveness = (1 - ALPHA) * (entry.effectiveness_score || 0.75) + ALPHA * (outcome === 'ADVANCE' ? 1.0 : 0.0);
    db.prepare(`
      UPDATE cultural_knowledge_base SET
        effectiveness_score = ?,
        advance_count = advance_count + ?,
        loop_count = loop_count + ?
      WHERE id = ?
    `).run(newEffectiveness, outcome === 'ADVANCE' ? 1 : 0, outcome === 'LOOP' ? 1 : 0, ckbEntryId);
  }
  db.close();
}

module.exports = {
  initCulturalSchema,
  seedInitialExamples,
  retrieveByConceptTag,
  logOutcome
};
