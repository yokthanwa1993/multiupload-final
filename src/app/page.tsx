import UploadClient from './components/UploadClient';
import ProtectedRoute from './components/ProtectedRoute';
import { cookies } from 'next/headers';
import { adminAuth } from './lib/firebase-admin';
import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';

export const dynamic = 'force-dynamic'; // Force dynamic rendering, disable caching

// --- Interfaces ---
interface YouTubeChannel {
  name: string;
  pfp: string;
}
interface FacebookPage {
  id: string;
  name:string;
  access_token: string;
  category: string;
}

// --- Server-side Data Fetching Functions ---

async function getFirebaseUser() {
  console.log("\n[SSR] 1. Attempting to get Firebase user from cookie...");
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('session');
  if (!sessionCookie?.value) {
    console.log("[SSR] 1.1. No session cookie found.");
    return null;
  }
  console.log("[SSR] 1.2. Session cookie found.");

  try {
    const decodedToken = await adminAuth.verifySessionCookie(sessionCookie.value, true);
    console.log(`[SSR] 1.3. Cookie verified for user UID: ${decodedToken.uid}`);
    return decodedToken;
  } catch (error) {
    console.log("[SSR] 1.4. Failed to verify session cookie:", error);
    return null;
  }
}

async function getYoutubeStatus(uid: string | null): Promise<YouTubeChannel | null> {
    console.log(`[SSR] 2. Checking YouTube status for UID: ${uid}`);
    if (!uid) return null;
    const dataDir = process.env.NODE_ENV === 'production' ? '/app/data' : process.cwd();
    const tokenPath = path.join(dataDir, `${uid}_youtube_token.json`);
    console.log(`[SSR] 2.1. Looking for YouTube token at: ${tokenPath}`);

    if (!fs.existsSync(tokenPath)) {
        console.log("[SSR] 2.2. YouTube token file not found.");
        return null;
    }
    console.log("[SSR] 2.3. YouTube token file found. Attempting to validate.");

    try {
        const tokenData = JSON.parse(fs.readFileSync(tokenPath, 'utf-8'));
        const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET
        );
        oauth2Client.setCredentials(tokenData);

        const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
        const channelRes = await youtube.channels.list({ part: ['snippet'], mine: true });
        const channel = channelRes.data.items?.[0];

        if (!channel) throw new Error("Could not fetch YouTube channel.");

        return {
            name: channel.snippet?.title || 'YouTube Channel',
            pfp: channel.snippet?.thumbnails?.default?.url || '/youtube-logo.png'
        };
    } catch (error) {
        console.error(`[SSR] 2.4. ERROR - Invalid YouTube token for user ${uid}. Deleting file.`, error);
        fs.unlinkSync(tokenPath);
        return null;
    }
}

async function getFacebookStatus(uid: string | null): Promise<FacebookPage | null> {
    console.log(`[SSR] 3. Checking Facebook status for UID: ${uid}`);
    if (!uid) return null;
    const dataDir = process.env.NODE_ENV === 'production' ? '/app/data' : process.cwd();
    const tokenPath = path.join(dataDir, `${uid}_facebook_token.json`);
    console.log(`[SSR] 3.1. Looking for Facebook token at: ${tokenPath}`);

    if (!fs.existsSync(tokenPath)) {
        console.log("[SSR] 3.2. Facebook token file not found.");
        return null;
    }
    console.log("[SSR] 3.3. Facebook token file found. Attempting to validate.");

    try {
        const tokenData = JSON.parse(fs.readFileSync(tokenPath, 'utf-8'));
        const validationUrl = `https://graph.facebook.com/v23.0/me?access_token=${tokenData.access_token}`;
        const response = await fetch(validationUrl);
        const validationData = await response.json();
        if (validationData.error) throw new Error(validationData.error.message);
        
        return tokenData;
    } catch (error) {
        console.error(`[SSR] 3.4. ERROR - Invalid Facebook token for user ${uid}. Deleting file.`, error);
        fs.unlinkSync(tokenPath);
        return null;
    }
}

export default async function Home() {
  console.log("--- [SSR] Home Page Render ---");
  const user = await getFirebaseUser();
  const youtubeChannel = await getYoutubeStatus(user?.uid || null);
  const facebookPage = await getFacebookStatus(user?.uid || null);
  console.log("[SSR] 4. Final statuses:", { hasYoutube: !!youtubeChannel, hasFacebook: !!facebookPage });

  return (
    <ProtectedRoute>
      <main className="min-h-screen flex items-center justify-center p-4">
        <div className="main-container">
          <UploadClient 
            key={user?.uid || 'logged-out'}
            initialYoutubeChannel={youtubeChannel} 
            initialFacebookPage={facebookPage}
          />
        </div>
      </main>
    </ProtectedRoute>
  );
}
