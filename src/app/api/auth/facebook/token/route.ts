import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { adminAuth } from '@/app/lib/firebase-admin';

async function getUserIdFromRequest(req: NextRequest): Promise<string | null> {
    const authorization = req.headers.get('Authorization');
    if (authorization?.startsWith('Bearer ')) {
        const idToken = authorization.split('Bearer ')[1];
        try {
            if (!adminAuth) throw new Error('Firebase Admin is not initialized');
            const decodedToken = await adminAuth.verifyIdToken(idToken);
            return decodedToken.uid;
        } catch (_error) {
            console.error("Error verifying ID token:", _error);
            return null;
        }
    }
    return null;
}

const dataDir = process.env.NODE_ENV === 'production' ? '/app/data' : process.cwd();

// Ensure the data directory exists
if (process.env.NODE_ENV === 'production' && !fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

export async function POST(req: NextRequest) {
  const uid = await getUserIdFromRequest(req);
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const pageData = await req.json();
    if (!pageData.id || !pageData.access_token) {
      return NextResponse.json({ error: 'Invalid page data provided.' }, { status: 400 });
    }

    const TOKEN_PATH = path.join(dataDir, `${uid}_facebook_token.json`);
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(pageData, null, 2));
    
    return NextResponse.json({ message: 'Token saved successfully.' }, { status: 200 });
  } catch (error) {
    console.error('Error saving Facebook token:', error);
    return NextResponse.json({ error: 'Failed to save token.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
    const uid = await getUserIdFromRequest(req);
    if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const TOKEN_PATH = path.join(dataDir, `${uid}_facebook_token.json`);
    if (fs.existsSync(TOKEN_PATH)) {
      fs.unlinkSync(TOKEN_PATH);
    }
    return NextResponse.json({ message: 'Token deleted successfully.' }, { status: 200 });
  } catch (error) {
    console.error('Error deleting Facebook token:', error);
    return NextResponse.json({ error: 'Failed to delete token.' }, { status: 500 });
  }
} 