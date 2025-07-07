import { initializeApp, getApps, cert, ServiceAccount } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

// Check if the service account environment variable exists
if (!process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    throw new Error('Firebase service account credentials are not set in .env.local');
}

// Decode the Base64 service account key
const serviceAccountString = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('ascii');
const serviceAccount = JSON.parse(serviceAccountString) as ServiceAccount;

// Initialize the Firebase Admin SDK if it hasn't been already
if (getApps().length === 0) {
    initializeApp({
        credential: cert(serviceAccount)
    });
}

export const adminAuth = getAuth();
export const adminDb = getFirestore(); // Export firestore in case we need it later 