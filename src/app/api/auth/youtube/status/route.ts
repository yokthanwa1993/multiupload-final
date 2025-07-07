import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { adminAuth } from '@/app/lib/firebase-admin';

const dataDir = process.env.NODE_ENV === 'production' ? '/app/data' : process.cwd();
const TOKEN_PATH = path.join(dataDir, 'token.json');

// Force dynamic execution to prevent caching
export const dynamic = 'force-dynamic';

async function getUserIdFromRequest(req: NextRequest): Promise<string | null> {
    const authorization = req.headers.get('Authorization');
    if (authorization?.startsWith('Bearer ')) {
        const idToken = authorization.split('Bearer ')[1];
        try {
            const decodedToken = await adminAuth.verifyIdToken(idToken);
            return decodedToken.uid;
        } catch (error) {
            return null; // Token is invalid or expired
        }
    }
    return null;
}

export async function DELETE(req: NextRequest) {
  const uid = await getUserIdFromRequest(req);
  if (!uid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const tokenPath = path.join(dataDir, `${uid}_youtube_token.json`);

    if (fs.existsSync(tokenPath)) {
      fs.unlinkSync(tokenPath);
    }
    return NextResponse.json({ success: true, message: 'YouTube connection deleted successfully' });
  } catch (error) {
    console.error('YouTube disconnect error:', error);
    return NextResponse.json({ success: false, error: 'Failed to disconnect YouTube' }, { status: 500 });
  }
}

// The refresh logic is now centralized in the library, so it's removed from here. 