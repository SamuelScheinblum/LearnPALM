const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI;

exports.handler = async (event) => {
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const db = client.db('sat-prep');
    const collection = db.collection('taxonomy');
    
    // Get taxonomy document (first one in collection)
    const taxonomy = await collection.findOne({});
    
    if (!taxonomy) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Taxonomy not found' })
      };
    }
    
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(taxonomy)
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