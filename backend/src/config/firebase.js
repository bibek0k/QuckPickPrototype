const admin = require('firebase-admin');
const logger = require('../utils/logger');

// Initialize Firebase Admin SDK
try {
  // In production, use service account key file
  // For development, use environment variables
  if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    const serviceAccount = require(process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: process.env.FIREBASE_DATABASE_URL,
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET
    });
  } else if (process.env.FIREBASE_PROJECT_ID) {
    // Initialize with individual environment variables
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL
      }),
      databaseURL: process.env.FIREBASE_DATABASE_URL,
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET
    });
  } else {
    throw new Error('Firebase configuration not found in environment variables');
  }

  logger.info('Firebase Admin SDK initialized successfully');
} catch (error) {
  logger.error('Failed to initialize Firebase Admin SDK:', error);
  process.exit(1);
}

// Export Firebase services
const db = admin.firestore();
const auth = admin.auth();
const storage = admin.storage();
const messaging = admin.messaging();

// Firestore settings
db.settings({
  ignoreUndefinedProperties: true
});

module.exports = {
  admin,
  db,
  auth,
  storage,
  messaging,
  FieldValue: admin.firestore.FieldValue,
  Timestamp: admin.firestore.Timestamp
};
