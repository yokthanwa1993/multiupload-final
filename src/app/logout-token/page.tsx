import { cookies } from 'next/headers';
import { adminAuth } from '@/app/lib/firebase-admin';
import fs from 'fs';
import path from 'path';
import LogoutClient from './LogoutClient';

async function getFirebaseUser() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('session');
  if (!sessionCookie?.value) return null;
  try {
    return await adminAuth.verifySessionCookie(sessionCookie.value, true);
  } catch (error) {
    return null;
  }
}

async function getPlatformStatus(uid: string | null, platform: 'youtube' | 'facebook'): Promise<boolean> {
    if (!uid) return false;
    const dataDir = process.env.NODE_ENV === 'production' ? '/app/data' : process.cwd();
    const tokenPath = path.join(dataDir, `${uid}_${platform}_token.json`);
    return fs.existsSync(tokenPath);
}

export default async function LogoutPage() {
    const user = await getFirebaseUser();
    
    const youtubeStatus = await getPlatformStatus(user?.uid || null, 'youtube');
    const facebookStatus = await getPlatformStatus(user?.uid || null, 'facebook');

    return (
        <main className="min-h-screen flex items-center justify-center p-4">
            <div className="main-container">
                <div className="glass-container">
                    <LogoutClient 
                        userName={user?.name || 'User'}
                        initialYoutubeStatus={youtubeStatus}
                        initialFacebookStatus={facebookStatus}
                    />
                </div>
            </div>
        </main>
    );
} 