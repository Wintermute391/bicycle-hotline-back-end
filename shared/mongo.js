import { MongoClient } from "mongodb";

const uri = process.env.MONGO_URI || "mongodb://localhost:27017/bicycle-hotline";
const client = new MongoClient(uri);
let db = null;

export async function connectToMongo() {
  if (db) return db;
  await client.connect();
  db = client.db();
  console.log("[mongo] connected", { uri });
  return db;
}

export function getDb() {
  if (!db) throw new Error("MongoDB not connected. Call connectToMongo() first.");
  return db;
}
