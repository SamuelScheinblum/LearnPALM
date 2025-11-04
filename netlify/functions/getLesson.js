const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI;

exports.handler = async (event) => {
  const lessonId = event.queryStringParameters?.id;
  
  if (!lessonId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Lesson ID required' })
    };
  }
  
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const db = client.db('sat-prep');
    const collection = db.collection('lessons');
    
    // Find lesson by ID
    const lesson = await collection.findOne({ id: lessonId });
    
    if (!lesson) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Lesson not found' })
      };
    }
    
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(lesson)
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