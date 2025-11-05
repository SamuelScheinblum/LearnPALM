// netlify/functions/getProblems.js
const { MongoClient } = require('mongodb');

let client;
let db;

// Optional: set COLLECTION in Netlify if you consolidate to one collection (e.g., "questions")
// Otherwise, use a whitelist mapping for Algebra skills to exact Atlas collection names.
const SKILL_TO_COLLECTION = {
  'linear-functions': 'Algebra - Linear Functions',
  'linear-equations-1var': 'Algebra - Linear Equations in One Variable',
  'linear-equations-2var': 'Algebra - Linear Equations in Two Variables',
};

function resolveCollectionName(skill) {
  if (process.env.COLLECTION && process.env.COLLECTION.trim()) {
    return process.env.COLLECTION.trim();
  }
  const key = (skill || '').toLowerCase();
  // Default to Algebra - Linear Functions so Algebra always returns something
  return SKILL_TO_COLLECTION[key] || 'Algebra - Linear Functions';
}

async function getDb() {
  // Validate and normalize URI from Netlify env vars
  const rawUri = (process.env.MONGODB_URI || '').trim();
  if (!rawUri || (!rawUri.startsWith('mongodb://') && !rawUri.startsWith('mongodb+srv://'))) {
    // Do not log secrets; just note that scheme is bad so logs reveal the misconfig
    console.error('Bad MONGODB_URI value: missing mongodb scheme');
    throw new Error('Server DB config invalid');
  }

  if (!client) {
    client = new MongoClient(rawUri, { maxIdleTimeMS: 60000 });
    await client.connect();
    db = client.db(process.env.DB_NAME || 'Questions'); // set DB_NAME in Netlify (e.g., "Questions")
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

  console.log(`getProblems: skill=${skill} type=${type} difficulty=${difficulty} qLang=${questionLang} eLang=${explanationLang}`);

  try {
    const database = await getDb();

    const collectionName = resolveCollectionName(skill);
    const collection = database.collection(collectionName);

    // Keep filter minimal so Algebra returns results even without optional fields
    const filter = {};
    if (type) filter.type = type;
    if (difficulty) filter.difficulty = difficulty;
    // If your docs include a 'skill' field and you want to narrow within the collection, you can enable:
    // if (skill) filter.skill = skill;

    const docs = await collection.find(filter).limit(50).toArray();

    // Language transformation for prompt/choices/explanation
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
        database: process.env.DB_NAME || 'Questions',
        collection: collectionName,
      }),
    };
  } catch (err) {
    // Check Site → Logs → Functions after calling the endpoint to see this message
    console.error('getProblems error:', err?.message || err);
    return { statusCode: 500, body: JSON.stringify({ error: err?.message || 'Unknown error' }) };
  }
  // Intentionally not closing client to allow connection reuse in serverless
};
