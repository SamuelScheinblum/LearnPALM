const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI;

exports.handler = async (event) => {
  // Get filter parameters from query string
  const section = event.queryStringParameters?.section || '';
  const type = event.queryStringParameters?.type || '';
  const difficulty = event.queryStringParameters?.difficulty || '';
  const skill = event.queryStringParameters?.skill || '';
  const questionLang = event.queryStringParameters?.questionLang || 'en';
  const explanationLang = event.queryStringParameters?.explanationLang || 'en';
  
  console.log(`📝 API Request - Section: ${section}, Type: ${type}, Skill: ${skill}, Difficulty: ${difficulty}`);
  console.log(`🌐 Languages - Question: ${questionLang}, Explanation: ${explanationLang}`);
  
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const db = client.db('sat-prep');
    const collection = db.collection('questions');
    
    // Build filter object
    const filter = {};
    if (section) filter.section = section;
    if (type) filter.type = type;
    if (difficulty) filter.difficulty = difficulty;
    if (skill) filter.skill = skill;
    
    // Query MongoDB
    const questions = await collection.find(filter).toArray();
    
    console.log(`✅ Found ${questions.length} matching questions`);
    
    // Transform questions to requested language[web:165]
    const transformedQuestions = questions.map(q => {
      const transformed = { ...q };
      
      // Transform prompt
      if (q.prompt && typeof q.prompt === 'object' && questionLang in q.prompt) {
        transformed.prompt = { [questionLang]: q.prompt[questionLang] };
      }
      
      // Transform choices
      if (Array.isArray(q.choices)) {
        transformed.choices = q.choices.map(choice => {
          if (typeof choice === 'object' && questionLang in choice) {
            return {
              key: choice.key || '',
              [questionLang]: choice[questionLang]
            };
          }
          return choice;
        });
      }
      
      // Transform explanation
      if (q.explanation && typeof q.explanation === 'object' && explanationLang in q.explanation) {
        transformed.explanation = { [explanationLang]: q.explanation[explanationLang] };
      }
      
      return transformed;
    });
    
    console.log(`🔄 Transformed ${transformedQuestions.length} questions`);
    
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        problems: transformedQuestions,
        total: transformedQuestions.length,
        questionLanguage: questionLang,
        explanationLanguage: explanationLang
      })
    };
    
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  } finally {
    await client.close();
  }
};