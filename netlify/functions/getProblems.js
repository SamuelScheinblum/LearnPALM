// netlify/functions/getProblems.js
const { MongoClient } = require('mongodb');

let client;
let db;

const SKILL_TO_COLLECTION = {
  // Algebra
  'linear-functions': 'Algebra - Linear Functions',
  'linear-equations-1var': 'Algebra - Linear Equations in One Variable',
  'linear-equations-2var': 'Algebra - Linear Equations in Two Variables',
  'systems-linear-equations': 'Algebra - Systems Linear Equations',
  'linear-inequalities': 'Algebra - Linear Inequalities',
  
  // Advanced Math
  'nonlinear-functions': 'Advanced Math - Nonlinear Functions',
  'nonlinear-equations-systems': 'Advanced Math - Nonlinear Equations & Systems',
  'equivalent-expressions': 'Advanced Math - Equivalent Expressions',
  
  // Problem-Solving and Data Analysis (PSDA)
  'ratios-rates-units': 'PSDA - Ratios Rates Units',
  'percentages': 'PSDA - Percentages',
  'one-variable-data': 'PSDA - One Variable Data',
  'two-variable-data': 'PSDA - Two Variable Data',
  'probability': 'PSDA - Probability',
  'inference-statistics': 'PSDA - Inference Statistics',
  'evaluating-claims': 'PSDA - Evaluating Claims',
  
  // Geometry and Trigonometry
  'area-volume': 'Geo-Trig - Area Volume',
  'lines-angles-triangles': 'Geo-Trig - Lines Angles Triangles',
  'right-triangles-trig': 'Geo-Trig - Right Triangles Trig',
  'circles': 'Geo-Trig - Circles',
  
  // Information and Ideas
  'central-ideas-details': 'Info-Ideas - Central Ideas Details',
  'inferences': 'Info-Ideas - Inferences',
  'command-evidence': 'Info-Ideas - Command Evidence',
  
  // Craft and Structure
  'words-in-context': 'Craft-Structure - Words in Context',
  'text-structure-purpose': 'Craft-Structure - Text Structure Purpose',
  'cross-text-connections': 'Craft-Structure - Cross-Text Connections',
  
  // Expression of Ideas
  'rhetorical-synthesis': 'Expression - Rhetorical Synthesis',
  'transitions': 'Expression - Transitions',
  
  // Standard English Conventions
  'boundaries': 'Standard-English - Boundaries',
  'form-structure-sense': 'Standard-English - Form Structure Sense',
};

function resolveCollectionNames(skill) {
  if (process.env.COLLECTION && process.env.COLLECTION.trim()) {
    return [process.env.COLLECTION.trim()];
  }
  
  const key = (skill || '').toLowerCase().trim();
  
  // If specific skill requested, return that collection
  if (key && SKILL_TO_COLLECTION[key]) {
    return [SKILL_TO_COLLECTION[key]];
  }
  
  // If no skill specified, return ALL skill collections
  return Object.values(SKILL_TO_COLLECTION);
}

async function getDb() {
  const rawUri = (process.env.MONGODB_URI || '').trim();
  if (!rawUri || (!rawUri.startsWith('mongodb://') && !rawUri.startsWith('mongodb+srv://'))) {
    console.error('Bad MONGODB_URI value: missing mongodb scheme');
    throw new Error('Server DB config invalid');
  }

  if (!client) {
    client = new MongoClient(rawUri, { maxIdleTimeMS: 60000 });
    await client.connect();
    await client.db('admin').command({ ping: 1 });
    console.log('MongoDB ping ok');
    db = client.db(process.env.DB_NAME || 'Questions');
  }
  return db;
}

exports.handler = async (event) => {
  const qp = event.queryStringParameters || {};
  const typeQ = (qp.type || '').toLowerCase().trim();
  const difficultyQ = (qp.difficulty || '').toLowerCase().trim();
  const skillQ = (qp.skill || '').toLowerCase().trim();
  const questionLang = (qp.questionLang || 'en').trim();
  const explanationLang = (qp.explanationLang || 'en').trim();

  console.log(`getProblems: skill=${skillQ} type=${typeQ} difficulty=${difficultyQ} qLang=${questionLang} eLang=${explanationLang}`);

  try {
    const database = await getDb();
    const collectionNames = resolveCollectionNames(skillQ);
    
    console.log(`Querying collections: ${collectionNames.join(', ')}`);

    let allProblems = [];

    // Query each collection (skill)
    for (const collectionName of collectionNames) {
      const collection = database.collection(collectionName);
      
      // Fetch ALL documents from this collection (no limit at doc level)
      const docs = await collection.find({}).toArray();
      
      console.log(`Collection ${collectionName}: ${docs.length} documents`);

      // Pick correct inner array name for your schema
      const innerField = (doc) => {
        if (Array.isArray(doc.questions)) return doc.questions;
        if (Array.isArray(doc.items)) return doc.items;
        if (Array.isArray(doc.problems)) return doc.problems;
        return [];
      };

      // Flatten documents to individual items
      const collectionProblems = docs.flatMap((doc) => {
        const inner = innerField(doc);

        return inner.map((q, idx) => {
          const id = q.id || `${doc._id?.toString?.() || 'doc'}:${idx}`;

          // Prompt
          let prompt = q.prompt;
          if (q.prompt && typeof q.prompt === 'object') {
            prompt = { [questionLang]: q.prompt[questionLang] || q.prompt.en || '' };
          }

          // Choices
          let choices = q.choices || [];
          if (Array.isArray(q.choices)) {
            choices = q.choices.map((choice) => {
              if (choice && typeof choice === 'object') {
                return {
                  key: choice.key || '',
                  [questionLang]: choice[questionLang] || choice.en || ''
                };
              }
              return choice;
            });
          }

          // Explanation
          let explanation = q.explanation;
          if (q.explanation && typeof q.explanation === 'object') {
            explanation = {
              [explanationLang]: q.explanation[explanationLang] || q.explanation.en || ''
            };
          }

          // Normalize metadata at item level with doc-level fallback
          const normType = String(q.type || doc.type || '').toLowerCase().trim();
          const normDifficulty = String(q.difficulty || doc.difficulty || '').toLowerCase().trim();
          const normSkill = String(q.skill || doc.skill || skillQ || '').toLowerCase().trim();

          return {
            id,
            parentId: doc._id,
            type: normType,
            difficulty: normDifficulty,
            skill: normSkill,
            prompt,
            choices,
            answer: q.answer,
            explanation,
            collection: collectionName, // Track which collection this came from
          };
        });
      });

      allProblems = allProblems.concat(collectionProblems);
    }

    console.log(`Total flattened problems before filtering: ${allProblems.length}`);

    // Apply item-level filters (case-insensitive, exact match)
    let filteredProblems = allProblems;

    if (typeQ) {
      filteredProblems = filteredProblems.filter(p => (p.type || '').toLowerCase() === typeQ);
      console.log(`After type filter (${typeQ}): ${filteredProblems.length}`);
    }
    
    if (difficultyQ) {
      filteredProblems = filteredProblems.filter(p => (p.difficulty || '').toLowerCase() === difficultyQ);
      console.log(`After difficulty filter (${difficultyQ}): ${filteredProblems.length}`);
    }
    
    if (skillQ) {
      filteredProblems = filteredProblems.filter(p => (p.skill || '').toLowerCase() === skillQ);
      console.log(`After skill filter (${skillQ}): ${filteredProblems.length}`);
    }

    console.log(`Final filtered count: ${filteredProblems.length}`);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        problems: filteredProblems,
        total: filteredProblems.length,
        questionLanguage: questionLang,
        explanationLanguage: explanationLang,
        database: process.env.DB_NAME || 'Questions',
        collections: collectionNames,
      }),
    };
  } catch (err) {
    console.error('getProblems error:', err?.message || err);
    return { statusCode: 500, body: JSON.stringify({ error: err?.message || 'Unknown error' }) };
  }
};