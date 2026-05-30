require('dotenv').config();
const { MongoClient } = require('mongodb');

const uri = process.env.MONGO_URI;
if (!uri) {
  console.error('MONGO_URI not set in .env');
  process.exit(1);
}

(async()=>{
  const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
  try{
    await client.connect();
    const sourceDb = client.db('test');
    const targetDb = client.db('teerhub');

    const sourceColl = sourceDb.collection('users');
    const targetColl = targetDb.collection('users');

    // copy only documents that have a defined email
    const docs = await sourceColl.find({ email: { $exists: true, $ne: null } }).toArray();
    if (!docs.length) {
      console.log('No users found in test.users');
      return;
    }

    for (const doc of docs) {
      const filter = { email: doc.email };
      const toInsert = {
        email: doc.email,
        name: doc.name,
        role: doc.role,
        password: doc.password,
        isVerified: doc.isVerified || true,
        createdAt: doc.createdAt || new Date(),
      };
      await targetColl.updateOne(filter, { $set: toInsert }, { upsert: true });
      console.log('Migrated', doc.email);
    }

    console.log('Migration complete');
  }catch(err){
    console.error('Migration error', err);
  }finally{
    await client.close();
  }
})();
