import UploadClient from './components/UploadClient';
import fs from 'fs';
import path from 'path';

const dataDir = process.env.NODE_ENV === 'production' ? '/app/data' : process.cwd();
const TOKEN_PATH = path.join(dataDir, 'token.json');

interface YouTubeChannel {
  name: string;
  pfp: string;
}

async function getYouTubeChannelInfo(accessToken: string): Promise<YouTubeChannel | null> {
  try {
    const response = await fetch(
      'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
        cache: 'no-store',
      }
    );

    if (!response.ok) {
      // If the token is expired/invalid, the API will return an error.
      // We can treat this as not being authenticated for the initial load.
      console.log('Server-side token validation failed during channel fetch.');
      return null;
    }

    const data = await response.json();
    if (data.items && data.items.length > 0) {
      const channel = data.items[0];
      return {
        name: channel.snippet.title,
        pfp: channel.snippet.thumbnails.default.url,
      };
    }
    return null;
  } catch (error) {
    console.error('Error fetching channel info on server:', error);
    return null;
  }
}

export default async function Home() {
  let initialAuthStatus = false;
  let initialYoutubeChannel: YouTubeChannel | null = null;

  // Read authentication status directly from the token file
  if (fs.existsSync(TOKEN_PATH)) {
    try {
      const tokenData = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'));
      if (tokenData.access_token && tokenData.refresh_token) {
        // Token file exists, now verify the token by fetching channel info
        initialYoutubeChannel = await getYouTubeChannelInfo(tokenData.access_token);
        if (initialYoutubeChannel) {
          initialAuthStatus = true;
        }
      }
    } catch (error) {
      console.error("Error reading or parsing token.json on server:", error);
      // If file is corrupt, treat as not authenticated
      initialAuthStatus = false;
      initialYoutubeChannel = null;
    }
  }

  return (
    <main className="main-container">
      <UploadClient 
        initialAuthStatus={initialAuthStatus}
        initialYoutubeChannel={initialYoutubeChannel}
      />
    </main>
  );
}
