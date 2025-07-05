import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { google } from 'googleapis';

// Force dynamic execution to prevent caching
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('youtube_access_token')?.value;
    const refreshToken = cookieStore.get('youtube_refresh_token')?.value;

    if (!accessToken || !refreshToken) {
      return NextResponse.json({ authenticated: false });
    }
    
    // We can do a quick check to see if the token is valid.
    // This is optional but good practice. For simplicity, we will assume if the token exists, it's valid.
    // The googleapis library will auto-refresh if it's expired during an API call.
    
    // For the status check, simply having the tokens is enough to be considered "authenticated".
    return NextResponse.json({ authenticated: true });

  } catch (error) {
    console.error('Status check error:', error);
    return NextResponse.json({ authenticated: false, error: 'Status check failed' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // On logout, clear both authentication cookies
    const response = NextResponse.json({ success: true, message: 'ออกจากระบบเรียบร้อย' });
    
    // Use .set with maxAge: 0 or .delete
    response.cookies.set('youtube_access_token', '', { maxAge: -1, path: '/' });
    response.cookies.set('youtube_refresh_token', '', { maxAge: -1, path: '/' });

    return response;
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json({ success: false, error: 'เกิดข้อผิดพลาดในการออกจากระบบ' }, { status: 500 });
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