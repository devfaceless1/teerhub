require('dotenv').config();
const { MongoClient } = require('mongodb');

const uri = process.env.MONGO_URI;
if (!uri) { console.error('MONGO_URI not set'); process.exit(1); }

(async()=>{
  const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
  try{
    await client.connect();
    const db = client.db('test');
    const coll = db.collection('users');
    const docs = await coll.find({}).limit(50).toArray();
    console.log('Found', docs.length, 'documents in test.users');
    docs.forEach((d,i)=>{
      console.log(i+1, { _id: d._id, email: d.email, keys: Object.keys(d) });
    });
  }catch(e){ console.error(e); }
  finally{ await client.close(); }
})();
