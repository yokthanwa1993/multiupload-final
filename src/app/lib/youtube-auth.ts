import { cookies } from 'next/headers';
import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

// Use /app/data in production for CapRover persistent storage, otherwise use project root.
const dataDir = process.env.NODE_ENV === 'production' ? '/app/data' : process.cwd();
const TOKEN_PATH = path.join(dataDir, 'token.json');

// Ensure the data directory exists before any operations.
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

export interface TokenInfo {
  accessToken: string;
  refreshToken: string;
  isRefreshed: boolean;
}

export async function getValidYouTubeToken(): Promise<TokenInfo | null> {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('youtube_access_token')?.value;
    const refreshToken = cookieStore.get('youtube_refresh_token')?.value;

    if (!refreshToken) {
      console.log('No refresh token found');
      return null;
    }

    let validAccessToken = accessToken;
    let isRefreshed = false;

    // ถ้าไม่มี access token หรือ token หมดอายุ ให้ refresh
    if (!validAccessToken || !(await testAccessToken(validAccessToken))) {
      console.log('Access token invalid or expired, refreshing...');
      
      const refreshResult = await refreshAccessToken(refreshToken);
      if (refreshResult) {
        validAccessToken = refreshResult.access_token;
        isRefreshed = true;
        console.log('Token refreshed successfully');
      } else {
        console.log('Failed to refresh token');
        return null;
      }
    }

    return {
      accessToken: validAccessToken!,
      refreshToken,
      isRefreshed
    };

  } catch (error) {
    console.error('Token validation error:', error);
    return null;
  }
}

async function testAccessToken(accessToken: string): Promise<boolean> {
  try {
    const response = await fetch(
      'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );
    
    return response.ok;
  } catch (error) {
    console.error('Token test error:', error);
    return false;
  }
}

async function refreshAccessToken(refreshToken: string) {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error('Missing Google OAuth credentials');
    }

    const params = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    });

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString()
    });

    if (!response.ok) {
      console.error('Token refresh failed:', await response.text());
      return null;
    }

    const tokens = await response.json();
    return tokens;

  } catch (error) {
    console.error('Token refresh error:', error);
    return null;
  }
}

export function updateTokenCookies(response: Response, accessToken: string, refreshToken?: string) {
  // Type assertion for NextResponse
  const nextResponse = response as any;
  
  if (nextResponse.cookies && nextResponse.cookies.set) {
    nextResponse.cookies.set('youtube_access_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 3600, // 1 hour
    });

    if (refreshToken) {
      nextResponse.cookies.set('youtube_refresh_token', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30, // 30 days
      });
    }
  }
}

interface TokenData {
  access_token: string;
  refresh_token: string;
  scope: string;
  token_type: string;
  expiry_date: number;
}

/**
 * Reads the token data from the file system.
 */
function readTokenFile(): TokenData | null {
  if (!fs.existsSync(TOKEN_PATH)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'));
}

/**
 * Writes the token data to the file system.
 */
function writeTokenFile(tokens: object) {
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
}

/**
 * Creates and configures an OAuth2 client, and sets up a listener
 * to automatically save refreshed tokens.
 */
export function getAuthenticatedClient(): OAuth2Client {
  const tokenData = readTokenFile();

  if (!tokenData) {
    throw new Error('Token file not found. Please authenticate via the web UI.');
  }

  if (!tokenData.refresh_token) {
    throw new Error('Refresh token is missing from token file. Please re-authenticate.');
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  oauth2Client.setCredentials({
    refresh_token: tokenData.refresh_token,
    access_token: tokenData.access_token
  });

  // Listen for token refresh events and save the new token automatically.
  oauth2Client.on('tokens', (newTokens) => {
    console.log('Tokens were automatically refreshed.');
    const updatedTokens = {
      ...tokenData,
      access_token: newTokens.access_token,
      expiry_date: newTokens.expiry_date,
    };
    writeTokenFile(updatedTokens);
    console.log('Token file has been updated with the new access token.');
  });

  return oauth2Client;
} 