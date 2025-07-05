import UploadClient from './components/UploadClient';
import { cookies } from 'next/headers';

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
      console.log('Server-side token validation failed, likely expired.');
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
  const cookieStore = cookies();
  const accessToken = cookieStore.get('youtube_access_token')?.value;
  let initialAuthStatus = !!accessToken;
  let initialYoutubeChannel: YouTubeChannel | null = null;

  if (accessToken) {
    initialYoutubeChannel = await getYouTubeChannelInfo(accessToken);
    // If fetching info fails, it means the token is invalid, so we are not authenticated.
    if (!initialYoutubeChannel) {
      initialAuthStatus = false;
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
