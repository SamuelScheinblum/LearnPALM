const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI;

exports.handler = async (event) => {
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const db = client.db('sat-prep');
    const collection = db.collection('questions');
    
    // Get all questions for statistics
    const allQuestions = await collection.find({}).toArray();
    
    // Calculate statistics
    const stats = {};
    
    for (const q of allQuestions) {
      const section = q.section || 'Unknown';
      const type = q.type || 'Unknown';
      const key = `${section} - ${type}`;
      
      stats[key] = (stats[key] || 0) + 1;
    }
    
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stats: stats,
        total: allQuestions.length
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