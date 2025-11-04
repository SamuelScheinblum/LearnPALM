// netlify/functions/getProblems.js
const { MongoClient } = require('mongodb');

let client;
let db;

// Map optional skill slugs to specific Algebra collections in Atlas
const SKILL_TO_COLLECTION = {
  'linear-functions': 'Algebra - Linear Functions',
  'linear-equations-1var': 'Algebra - Linear Equations in One Variable',
  'linear-equations-2var': 'Algebra - Linear Equations in Two Variables',
};

// Resolve the collection name with safe defaults:
// 1) If COLLECTION env var is set, use it (single shared collection scenario).
// 2) Else if a known skill is provided, map it to the exact Algebra collection.
// 3) Else default to Algebra - Linear Functions so Algebra always shows questions.
function resolveCollectionName(skill) {
  if (process.env.COLLECTION && process.env.COLLECTION.trim()) {
    return process.env.COLLECTION.trim();
  }
  const key = (skill || '').toLowerCase();
  return SKILL_TO_COLLECTION[key] || 'Algebra - Linear Functions';
}

async function getDb() {
  if (!client) {
    client = new MongoClient(process.env.MONGODB_URI, { maxIdleTimeMS: 60000 });
    await client.connect();
    db = client.db(process.env.DB_NAME || 'Questions');
  }
  return db;
}

exports.handler = async (event) => {
  const qp = event.queryStringParameters || {};
  const type = (qp.type || '').toLowerCase();
  const difficulty = (qp.difficulty || '').toLowerCase();
  const skill = (qp.skill || '').toLowerCase();
  const questionLang = qp.questionLang || 'en';
  const explanationLang = qp.explanationLang || 'en';

  // Log minimal, non‑secret context for debugging in Netlify Function logs
  console.log(`getProblems: skill=${skill} type=${type} difficulty=${difficulty} qLang=${questionLang} eLang=${explanationLang}`);

  try {
    const database = await getDb();
    const collectionName = resolveCollectionName(skill);
    const collection = database.collection(collectionName);

    // Keep filter minimal so Algebra returns results even if some fields aren’t present
    const filter = {};
    if (type) filter.type = type;
    if (difficulty) filter.difficulty = difficulty;
    // If your docs include a 'skill' field and you want to narrow within the collection, uncomment:
    // if (skill) filter.skill = skill;

    // Empty filter finds all docs; toArray() materializes the cursor into memory for the response
    const docs = await collection.find(filter).limit(50).toArray();

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

    // Surface which DB/collection were used to help you verify selection
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        problems,
        total: problems.length,
        questionLanguage: questionLang,
        explanationLanguage: explanationLang,
        database: process.env.DB_NAME || 'Questions',
        collection: collectionName,
      }),
    };
  } catch (err) {
    console.error('getProblems error:', err?.message || err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err?.message || 'Unknown error' }),
    };
  }
  // Do not close the client; reusing across invocations improves serverless performance
};
