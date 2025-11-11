const { MongoClient } = require('mongodb');

let client;
let db;

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
    console.log('MongoDB ping ok for Lessons');
    db = client.db(process.env.DB_NAME2 || 'Lessons');
  }
  return db;
}

exports.handler = async (event) => {
  const lang = event.queryStringParameters?.lang || 'en';
  const category = event.queryStringParameters?.category; // optional filter
  
  try {
    const database = await getDb();
    
    // Get lessons from all collections
    const collections = ['Math', 'Reading-Writing', 'Test-Skills'];
    let allLessons = [];
    
    for (const collectionName of collections) {
      const collection = database.collection(collectionName);
      const lessons = await collection.find({}).toArray();
      
      // Add collection name to each lesson for reference
      const lessonsWithCategory = lessons.map(lesson => ({
        ...lesson,
        collection: collectionName
      }));
      
      allLessons = allLessons.concat(lessonsWithCategory);
      console.log(`Found ${lessons.length} lessons in ${collectionName}`);
    }
    
    // Optional: filter by category if provided
    if (category) {
      allLessons = allLessons.filter(lesson => 
        lesson.category?.toLowerCase() === category.toLowerCase()
      );
    }
    
    // Try to get metadata (optional - may not exist yet)
    let metadata = {};
    try {
      const metadataCollection = database.collection('Metadata');
      const metadataDoc = await metadataCollection.findOne({});
      metadata = metadataDoc || {};
    } catch (err) {
      console.log('No metadata collection found, using defaults');
    }
    
    const lessonsData = {
      lessons: allLessons,
      total: allLessons.length,
      copy: metadata?.copy || {},
      categories: metadata?.categories || {},
      language: lang
    };
    
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(lessonsData)
    };
    
  } catch (error) {
    console.error('getLessons error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};