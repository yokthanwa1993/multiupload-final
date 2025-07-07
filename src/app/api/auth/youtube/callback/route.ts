import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Use the same logic as the auth library to determine the token path
const dataDir = process.env.NODE_ENV === 'production' ? '/app/data' : process.cwd();
const TOKEN_PATH = path.join(dataDir, 'token.json');

// Ensure the data directory exists
if (process.env.NODE_ENV === 'production' && !fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

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
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
    if (!baseUrl) {
      throw new Error("NEXT_PUBLIC_BASE_URL is not defined in environment");
    }
    const redirectUri = `${baseUrl}/api/auth/youtube/callback`;
    
    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const errorBody = await tokenResponse.json();
      console.error('Failed to exchange code for tokens:', errorBody);
      throw new Error(`Failed to exchange code for tokens: ${errorBody.error_description || 'Unknown error'}`);
    }

    const tokens = await tokenResponse.json();

    // Ensure we get a refresh token
    if (!tokens.refresh_token) {
      console.warn('Warning: Did not receive a refresh token. User may need to re-authenticate later.');
      console.warn('This can happen if the user has already granted consent previously.');
    }
    
    // Save tokens to the JSON file
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
    console.log('Tokens saved to:', TOKEN_PATH);
    
    // This route no longer sets cookies, it only saves the file.
    // The client-side will be notified to reload its state.
    const response = new NextResponse(`
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.location.reload();
            }
            window.close();
          </script>
        </body>
      </html>
    `, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    
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