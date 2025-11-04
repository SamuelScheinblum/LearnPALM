const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI;

exports.handler = async (event) => {
  const lang = event.queryStringParameters?.lang || 'en';
  
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const db = client.db('sat-prep');
    const lessonsCollection = db.collection('lessons');
    
    // Get all lessons
    const lessons = await lessonsCollection.find({}).toArray();
    
    // Get lessons metadata (copy, categories, etc)
    const metadataCollection = db.collection('lessons_metadata');
    const metadata = await metadataCollection.findOne({});
    
    const lessonsData = {
      lessons: lessons,
      copy: metadata?.copy || {},
      categories: metadata?.categories || {}
    };
    
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(lessonsData)
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