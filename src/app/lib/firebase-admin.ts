import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';

const SERVICE_ACCOUNT_PATH = path.join(process.cwd(), 'firebase-service-account.json');

// In production on CapRover, this file will be mounted at /app/data/
const PROD_SERVICE_ACCOUNT_PATH = '/app/data/firebase-service-account.json';

const serviceAccountPath = fs.existsSync(PROD_SERVICE_ACCOUNT_PATH)
  ? PROD_SERVICE_ACCOUNT_PATH
  : SERVICE_ACCOUNT_PATH;

try {
  if (getApps().length === 0) {
    // Try to use environment variable first
    if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
      const serviceAccountBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
      const serviceAccountJson = Buffer.from(serviceAccountBase64, 'base64').toString('utf8');
      const serviceAccount = JSON.parse(serviceAccountJson);
      
      initializeApp({
        credential: cert(serviceAccount)
      });
      console.log("Firebase Admin SDK initialized using environment variable.");
    } 
    // Fall back to file-based initialization
    else if (fs.existsSync(serviceAccountPath)) {
      initializeApp({
        credential: cert(serviceAccountPath)
      });
      console.log("Firebase Admin SDK initialized using service account file.");
    } 
    else {
      console.warn("Firebase Admin SDK not initialized. No service account found.");
    }
  }
} catch (error) {
    console.error("Firebase Admin SDK initialization error:", error);
}

// Export auth and firestore, they will work only if initialization was successful
export const adminAuth = getApps().length ? getAuth() : null;
export const adminDb = getApps().length ? getFirestore() : null; 