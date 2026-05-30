const { MongoClient } = require('mongodb');
require('dotenv').config();

async function run(){
  const uri = process.env.MONGO_URI;
  if(!uri){
    console.error('MONGO_URI not set in .env');
    process.exit(1);
  }
  const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
  try{
    await client.connect();
    const db = client.db();
    const coll = db.collection('users');
    const indexes = await coll.indexes();
    console.log('Existing indexes:', indexes.map(i=>i.name));
    const idxName = 'telegramId_1';
    const exists = indexes.some(i=>i.name===idxName);
    if(!exists){
      console.log(idxName, 'not found — nothing to do');
      return;
    }
    console.log('Dropping index', idxName);
    await coll.dropIndex(idxName);
    console.log('Dropped');
  }catch(err){
    console.error('Error:', err);
    process.exit(2);
  }finally{
    await client.close();
  }
}

run();
