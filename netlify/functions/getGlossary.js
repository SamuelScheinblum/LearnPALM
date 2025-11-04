const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI;

exports.handler = async (event) => {
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const db = client.db('sat-prep');
    const collection = db.collection('glossary');
    
    // Get glossary document
    const glossary = await collection.findOne({});
    
    if (!glossary) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Glossary not found' })
      };
    }
    
    // Return terms array or entire glossary
    const terms = Array.isArray(glossary) ? glossary : glossary.terms || [];
    
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        glossary: terms
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