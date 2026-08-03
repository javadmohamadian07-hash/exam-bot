import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { config } from './env.js';

let mongoMemoryServer = null;

export async function connectDB() {
  try {
    let uri = config.mongoUri;

    if (!uri) {
      console.log('No MONGODB_URI provided. Starting in-memory MongoDB server...');
      mongoMemoryServer = await MongoMemoryServer.create();
      uri = mongoMemoryServer.getUri();
      console.log(`In-memory MongoDB started at: ${uri}`);
    }

    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
    });

    console.log(`MongoDB Connected successfully to ${mongoose.connection.host}`);
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    if (!mongoMemoryServer) {
      console.log('Falling back to MongoMemoryServer after connection failure...');
      try {
        mongoMemoryServer = await MongoMemoryServer.create();
        const fallbackUri = mongoMemoryServer.getUri();
        await mongoose.connect(fallbackUri);
        console.log(`Fallback in-memory MongoDB connected successfully`);
      } catch (fallbackError) {
        console.error('Fatal: Failed to connect to fallback MongoDB:', fallbackError.message);
        process.exit(1);
      }
    } else {
      process.exit(1);
    }
  }
}

export async function disconnectDB() {
  await mongoose.disconnect();
  if (mongoMemoryServer) {
    await mongoMemoryServer.stop();
  }
}
