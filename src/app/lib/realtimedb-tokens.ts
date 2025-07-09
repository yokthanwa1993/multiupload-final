import { adminDb } from './firebase-admin';

if (!adminDb) {
  throw new Error('Realtime Database is not initialized. Make sure firebase-admin is configured correctly.');
}

const db = adminDb;

export const setToken = async (uid: string, platform: 'youtube' | 'facebook', tokenData: object) => {
  const tokenRef = db.ref(`tokens/${uid}/${platform}`);
  await tokenRef.set(tokenData);
};

export const getToken = async (uid: string, platform: 'youtube' | 'facebook') => {
  const tokenRef = db.ref(`tokens/${uid}/${platform}`);
  const snapshot = await tokenRef.once('value');
  return snapshot.val();
};

export const deleteToken = async (uid: string, platform: 'youtube' | 'facebook') => {
  const tokenRef = db.ref(`tokens/${uid}/${platform}`);
  await tokenRef.remove();
}; 