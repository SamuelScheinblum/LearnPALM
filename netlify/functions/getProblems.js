// netlify/functions/getProblems.js
const { MongoClient } = require('mongodb');

let client;
let db;

// Map requested skill slugs to your Atlas collection names
// Adjust slugs as needed to match your frontend
const SKILL_TO_COLLECTION = {
  'linear-functions': 'Algebra - Linear Functions',
  'linear-equations-1var': 'Algebra - Linear Equations in One Variable',
  'linear-equations-2var': 'Algebra - Linear Equations in Two Variables',
};

async function getDb() {
  if (!client) {
    client = new MongoClient(process.env.MONGODB_URI, { maxIdleTimeMS: 60000 });
    await client.connect();
    db = client.db(process.env.DB_NAME || 'Questions'); // Your DB is "Questions"
  }
  return db;
}

exports.handler = async (event) => {
  // Read query parameters
  const qp = event.queryStringParameters || {};
  const section = (qp.section || '').toLowerCase();
  const type = (qp.type || '').toLowerCase();
  const difficulty = (qp.difficulty || '').toLowerCase();
  const skill = (qp.skill || '').toLowerCase();
  const questionLang = qp.questionLang || 'en';
  const explanationLang = qp.explanationLang || 'en';

  try {
    const database = await getDb();

    // Choose collection
    // If you later consolidate to a single collection, replace with process.env.COLLECTION || 'questions'
    const collectionName =
      SKILL_TO_COLLECTION[skill] || 'Algebra - Linear Functions';

    const collection = database.collection(collectionName);

    // Build filter safely (only allow known fields)
    const filter = {};
    if (section) filter.section = section;
    if (type) filter.type = type;
    if (difficulty) filter.difficulty = difficulty;
    // If your documents also have a 'skill' field, you can optionally include it:
    // if (skill) filter.skill = skill;

    // Query
    const questions = await collection.find(filter).limit(50).toArray();

    // Language-transform fields
    const transformedQuestions = questions.map((q) => {
      const transformed = { ...q };

      if (q.prompt && typeof q.prompt === 'object' && questionLang in q.prompt) {
        transformed.prompt = { [questionLang]: q.prompt[questionLang] };
      }

      if (Array.isArray(q.choices)) {
        transformed.choices = q.choices.map((choice) => {
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
        transformed.explanation = {
          [explanationLang]: q.explanation[explanationLang],
        };
      }

      return transformed;
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        problems: transformedQuestions,
        total: transformedQuestions.length,
        questionLanguage: questionLang,
        explanationLanguage: explanationLang,
        collection: collectionName,
      }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
  // Do NOT close the client; keeping it warm allows connection reuse in serverless
};
