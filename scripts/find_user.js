require('dotenv').config();
const { MongoClient } = require('mongodb');

const email = process.argv[2];
if (!email) {
  console.error('Usage: node scripts/find_user.js <email>');
  process.exit(1);
}

const uri = process.env.MONGO_URI;
if (!uri) {
  console.error('MONGO_URI not set in .env');
  process.exit(1);
}

(async()=>{
  const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
  try{
    await client.connect();
    const db = client.db();
    const coll = db.collection('users');
    const user = await coll.findOne({ email: email });
    if (!user) {
      console.log('User not found in database:', db.databaseName);
    } else {
      console.log('Found user in database:', db.databaseName);
      console.log(user);
    }
  }catch(err){
    console.error('Error:', err);
    process.exit(2);
  }finally{
    await client.close();
  }
})();
