import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error) {
    console.error('OAuth error:', error);
    return new NextResponse(`
      <html>
        <body>
          <script>
            window.opener.postMessage({ error: '${error}' }, window.location.origin);
            window.close();
          </script>
        </body>
      </html>
    `, { headers: { 'Content-Type': 'text/html' } });
  }

  if (!code) {
    return new NextResponse(`
      <html>
        <body>
          <script>
            window.opener.postMessage({ error: 'No authorization code received' }, window.location.origin);
            window.close();
          </script>
        </body>
      </html>
    `, { headers: { 'Content-Type': 'text/html' } });
  }

  try {
    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        code,
        grant_type: 'authorization_code',
        redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
      }),
    });

    if (!tokenResponse.ok) {
      throw new Error('Failed to exchange code for tokens');
    }

    const tokens = await tokenResponse.json();

    // Get channel information
    const channelResponse = await fetch(
      'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',
      {
        headers: {
          'Authorization': `Bearer ${tokens.access_token}`,
        },
      }
    );

    if (!channelResponse.ok) {
      throw new Error('Failed to fetch channel information');
    }

    const channelData = await channelResponse.json();
    let channelName = 'YouTube Channel';
    let localProfilePicPath = '/logo.png'; // Default fallback

    if (channelData.items && channelData.items.length > 0) {
      const channel = channelData.items[0];
      channelName = channel.snippet.title;
      
      // Download profile picture and save locally
      if (channel.snippet.thumbnails && channel.snippet.thumbnails.default) {
        try {
          const profilePicUrl = channel.snippet.thumbnails.default.url;
          const response = await fetch(profilePicUrl);
          
          if (response.ok) {
            const buffer = await response.arrayBuffer();
            const fileName = `youtube_profile_${Date.now()}.jpg`;
            const filePath = path.join(process.cwd(), 'public', fileName);
            
            // Save the image to public folder
            fs.writeFileSync(filePath, Buffer.from(buffer));
            localProfilePicPath = `/${fileName}`;
          }
        } catch (downloadError) {
          console.error('Failed to download profile picture:', downloadError);
          // Keep default fallback path
        }
      }
    }

    // Store tokens in cookies
    const response = new NextResponse(`
      <html>
        <body>
          <script>
            window.opener.postMessage({ 
              auth: 'success', 
              channelName: ${JSON.stringify(channelName)},
              channelPfp: '${localProfilePicPath}'
            }, window.location.origin);
            window.close();
          </script>
        </body>
      </html>
    `, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });

    // Set HTTP-only cookies for tokens
    response.cookies.set('youtube_access_token', tokens.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: tokens.expires_in || 3600,
    });

    if (tokens.refresh_token) {
      response.cookies.set('youtube_refresh_token', tokens.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30, // 30 days
      });
    }

    return response;
  } catch (error) {
    console.error('OAuth callback error:', error);
    return new NextResponse(`
      <html>
        <body>
          <script>
            window.opener.postMessage({ error: 'Authentication failed' }, window.location.origin);
            window.close();
          </script>
        </body>
      </html>
    `, { headers: { 'Content-Type': 'text/html' } });
  }
} 