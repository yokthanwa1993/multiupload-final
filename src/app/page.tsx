import UploadClient from './components/UploadClient';
import { getAuthenticatedClient } from './lib/youtube-auth';
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

interface YouTubeChannel {
  name: string;
  pfp: string;
}

// Function to check authentication status on the server-side
async function getAuthenticationStatus(): Promise<{
  isAuthenticated: boolean;
  channelInfo: YouTubeChannel | null;
}> {
  const dataDir = process.env.NODE_ENV === 'production' ? '/app/data' : process.cwd();
  const tokenPath = path.join(dataDir, 'token.json');
  const pfpDir = path.join(process.cwd(), 'public');

  console.log(`[SSR] Checking for token at: ${tokenPath}`);

  if (!fs.existsSync(tokenPath)) {
    console.log('[SSR] Token file not found.');
    return { isAuthenticated: false, channelInfo: null };
  }

  console.log('[SSR] Token file found. Attempting to get authenticated client.');

  try {
    const oauth2Client = getAuthenticatedClient();
    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
    
    const res = await youtube.channels.list({
      part: ['snippet'],
      mine: true,
    });

    if (res.data.items && res.data.items.length > 0) {
      const channel = res.data.items[0];
      let localPfpPath = '/logo.png';

      // Find the most recent profile picture if it exists
      const files = fs.readdirSync(pfpDir);
      const profilePics = files
        .filter(file => file.startsWith('youtube_profile_'))
        .sort((a, b) => {
          const timeA = parseInt(a.split('_').pop()?.split('.')[0] || '0');
          const timeB = parseInt(b.split('_').pop()?.split('.')[0] || '0');
          return timeB - timeA;
        });

      if (profilePics.length > 0) {
        localPfpPath = `/${profilePics[0]}`;
      }
      
      return {
        isAuthenticated: true,
        channelInfo: {
          name: channel.snippet?.title || 'YouTube Channel',
          pfp: localPfpPath,
        },
      };
    }
    return { isAuthenticated: true, channelInfo: null }; // Authenticated but couldn't fetch channel
  } catch (error) {
    console.error('[SSR] Failed to verify token on server-side:', error);
    // If token is invalid, delete it to force re-login
    try {
      fs.unlinkSync(tokenPath);
      console.log('[SSR] Invalid token file deleted.');
    } catch (unlinkError) {
      console.error('[SSR] Failed to delete invalid token file:', unlinkError);
    }
    return { isAuthenticated: false, channelInfo: null };
  }
}

export default async function Home() {
  const { isAuthenticated, channelInfo } = await getAuthenticationStatus();

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="main-container">
        <UploadClient 
          initialAuthStatus={isAuthenticated} 
          initialYoutubeChannel={channelInfo} 
        />
      </div>
    </main>
  );
}
