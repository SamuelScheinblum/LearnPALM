// netlify/functions/getProblems.js
const { MongoClient } = require('mongodb');

let client;
let db;

// Map skill slugs to Atlas collection names (adjust to your exact names)
const SKILL_TO_COLLECTION = {
  'linear-functions': 'Algebra - Linear Functions',
  'linear-equations-1var': 'Algebra - Linear Equations in One Variable',
  'linear-equations-2var': 'Algebra - Linear Equations in Two Variables',
};

// If you consolidate to a single collection later, set COLLECTION in Netlify
// and this helper will prefer that. Otherwise, it maps from `skill`.
function resolveCollectionName(skill) {
  if (process.env.COLLECTION) return process.env.COLLECTION;
  return SKILL_TO_COLLECTION[skill?.toLowerCase?.()] || 'Algebra - Linear Functions';
}

async function getDb() {
  if (!client) {
    client = new MongoClient(process.env.MONGODB_URI, { maxIdleTimeMS: 60000 });
    await client.connect(); // keep client warm across invocations
    db = client.db(process.env.DB_NAME || 'Questions'); // Your DB name in Atlas
  }
  return db;
}

exports.handler = async (event) => {
  const qp = event.queryStringParameters || {};
  const section = (qp.section || '').toLowerCase();
  const type = (qp.type || '').toLowerCase();
  const difficulty = (qp.difficulty || '').toLowerCase();
  const skill = (qp.skill || '').toLowerCase();
  const questionLang = qp.questionLang || 'en';
  const explanationLang = qp.explanationLang || 'en';

  // Minimal request logging for debugging in Netlify Function logs
  console.log(`getProblems params: section=${section} type=${type} skill=${skill} difficulty=${difficulty} qLang=${questionLang} eLang=${explanationLang}`);

  try {
    const database = await getDb();

    const collectionName = resolveCollectionName(skill);
    const collection = database.collection(collectionName);

    // Build a safe filter (only allow known filters)
    const filter = {};
    if (section) filter.section = section;
    if (type) filter.type = type;
    if (difficulty) filter.difficulty = difficulty;
    // If your documents include a 'skill' field and you want to filter by it, uncomment:
    // if (skill) filter.skill = skill;

    // Query MongoDB; add a sensible limit
    const docs = await collection.find(filter).limit(50).toArray();

    // Language transform
    const problems = docs.map((q) => {
      const t = { ...q };

      if (q.prompt && typeof q.prompt === 'object' && questionLang in q.prompt) {
        t.prompt = { [questionLang]: q.prompt[questionLang] };
      }

      if (Array.isArray(q.choices)) {
        t.choices = q.choices.map((choice) => {
          if (choice && typeof choice === 'object' && questionLang in choice) {
            return { key: choice.key || '', [questionLang]: choice[questionLang] };
          }
          return choice;
        });
      }

      if (q.explanation && typeof q.explanation === 'object' && explanationLang in q.explanation) {
        t.explanation = { [explanationLang]: q.explanation[explanationLang] };
      }

      return t;
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        problems,
        total: problems.length,
        questionLanguage: questionLang,
        explanationLanguage: explanationLang,
        collection: collectionName,
        database: process.env.DB_NAME || 'Questions',
      }),
    };
  } catch (err) {
    console.error('getProblems error:', err?.message || err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err?.message || 'Unknown error' }),
    };
  }
  // Intentionally not closing the client to allow connection reuse in serverless
};
