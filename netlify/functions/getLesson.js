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
  const lessonId = event.queryStringParameters?.id;
  
  if (!lessonId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Lesson ID required' })
    };
  }
  
  try {
    const database = await getDb();
    
    // Search across all lesson collections
    const collections = ['Math', 'Reading-Writing', 'Test-Skills'];
    let lesson = null;
    
    for (const collectionName of collections) {
      const collection = database.collection(collectionName);
      lesson = await collection.findOne({ id: lessonId });
      
      if (lesson) {
        console.log(`Found lesson ${lessonId} in ${collectionName}`);
        break;
      }
    }
    
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
    console.error('getLesson error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};