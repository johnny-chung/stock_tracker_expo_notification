// MongoDB client service: connects once and exposes helpers to get DB/collections.
import { MongoClient } from "mongodb";
import "dotenv/config";

let client;
let db;

export async function connectMongo() {
  const uri = process.env.MONGO_URI;
  const dbName = process.env.MONGO_DB_NAME;

  if (!uri || !dbName) {
    throw new Error("Missing MONGO_URI or MONGO_DB_NAME in environment.");
  }

  if (client && db) {
    return { client, db };
  }

  client = new MongoClient(uri, {
    // keep connection alive and resilient
    maxPoolSize: 10,
    minPoolSize: 1,
    retryWrites: true,
    serverSelectionTimeoutMS: 10000,
  });

  await client.connect();
  db = client.db(dbName);
  console.log(`[mongo] Connected to ${dbName}`);
  return { client, db };
}

export function getDb() {
  if (!db) {
    throw new Error("Mongo not connected. Call connectMongo() first.");
  }
  return db;
}

export function getCollection(name) {
  return getDb().collection(name);
}

export async function disconnectMongo() {
  if (client) {
    await client.close();
    client = undefined;
    db = undefined;
    console.log("[mongo] Disconnected");
  }
}
