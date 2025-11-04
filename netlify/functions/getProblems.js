// netlify/functions/getProblems.js
const { MongoClient } = require('mongodb');

let client;
let db;

// Optional: set COLLECTION in Netlify to use a single shared collection (e.g., "questions")
// Otherwise, this whitelist maps skill slugs to your Atlas collection names
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
  return SKILL_TO_COLLECTION[key] || 'Algebra - Linear Functions';
}

async function getDb() {
  if (!client) {
    client = new MongoClient(process.env.MONGODB_URI, {
      maxIdleTimeMS: 60000, // keep warm between invocations
    });
    await client.connect();
    db = client.db(process.env.DB_NAME || 'Questions'); // your Atlas DB that contains the Algebra collections
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

  console.log(
    `getProblems: section=${section} type=${type} skill=${skill} difficulty=${difficulty} qLang=${questionLang} eLang=${explanationLang}`
  );

  try {
    const database = await getDb();
    const collectionName = resolveCollectionName(skill);
    const collection = database.collection(collectionName);

    // Build a safe query document
    const filter = {};
    if (section) filter.section = section;
    if (type) filter.type = type;
    if (difficulty) filter.difficulty = difficulty;
    // If your documents include a 'skill' field and you want to filter by it, uncomment:
    // if (skill) filter.skill = skill;

    const cursor = collection.find(filter).limit(50);
    const docs = await cursor.toArray();

    // Language-focused transform of prompt/choices/explanation
    const problems = docs.map((q) => {
      const t = { ...q };

      if (q.prompt && typeof q.prompt === 'object' && questionLang in q.prompt) {
        t.prompt = { [questionLang]: q.prompt[questionLang] };
      }

      if (Array.isArray(q.choices)) {
        t.choices = q.choices.map((choice) => {
          if (choice && typeof choice === 'object' && questionLang in choice) {
            return {
              key: choice.key || '',
              [questionLang]: choice[questionLang],
            };
          }
          return choice;
        });
      }

      if (
        q.explanation &&
        typeof q.explanation === 'object' &&
        explanationLang in q.explanation
      ) {
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
    console.error('getProblems error:', err?.message || err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err?.message || 'Unknown error' }),
    };
  }
  // Do not close the client; reusing the connection is recommended for serverless
};
