import fs from 'fs';
import path from 'path';
import { cookies } from 'next/headers';
import { adminAuth } from '@/app/lib/firebase-admin';
import FacebookManagerClient from './FacebookManagerClient';

interface FacebookPage {
    id: string;
    name: string;
    access_token: string;
    category: string;
}

async function getFacebookStatus(uid: string | null): Promise<FacebookPage | null> {
  if (!uid) return null;
  
  const dataDir = process.env.NODE_ENV === 'production' ? '/app/data' : process.cwd();
  const TOKEN_PATH = path.join(dataDir, `${uid}_facebook_token.json`);
  
  if (fs.existsSync(TOKEN_PATH)) {
      try {
        const tokenData = fs.readFileSync(TOKEN_PATH, 'utf-8');
        return JSON.parse(tokenData);
      } catch (error) {
          console.error("Could not read or parse user-specific facebook token:", error);
          return null;
      }
  }
  return null;
}

export default async function FacebookPage() {
    let uid: string | null = null;
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session');

    if (sessionCookie?.value) {
        try {
            const decodedToken = await adminAuth.verifySessionCookie(sessionCookie.value, true);
            uid = decodedToken.uid;
        } catch (error) {
            // Invalid cookie, ignore.
        }
    }
    
    const selectedPage = await getFacebookStatus(uid);

    return (
        <main className="min-h-screen flex items-center justify-center p-4">
            <div className="main-container">
                <div className="glass-container">
                    <FacebookManagerClient initialSelectedPage={selectedPage} />
                </div>
            </div>
        </main>
    );
} 