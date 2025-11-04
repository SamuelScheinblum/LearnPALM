const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI;

exports.handler = async (event) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }
  
  try {
    const data = JSON.parse(event.body);
    const questionId = data.id;
    const userAnswer = data.answer;
    
    if (!questionId || !userAnswer) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing question ID or answer' })
      };
    }
    
    const client = new MongoClient(uri);
    
    try {
      await client.connect();
      const db = client.db('sat-prep');
      const collection = db.collection('questions');
      
      // Find question by ID
      const question = await collection.findOne({ id: questionId });
      
      if (!question) {
        return {
          statusCode: 404,
          body: JSON.stringify({ correct: false, error: 'Question not found' })
        };
      }
      
      // Check if answer is correct
      const correct = (userAnswer === question.answer);
      
      return {
        statusCode: 200,
        body: JSON.stringify({
          correct: correct,
          correct_answer: question.answer
        })
      };
      
    } finally {
      await client.close();
    }
    
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};