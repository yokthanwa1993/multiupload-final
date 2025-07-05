import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { cookies } from 'next/headers';

// YouTube OAuth configuration
const YOUTUBE_OAUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube'
].join(' ');

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const returnTo = searchParams.get('returnTo') || '/';

    if (action === 'login') {
      // Check if we have required environment variables
      const clientId = process.env.GOOGLE_CLIENT_ID;
      const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/youtube/callback`;

      if (!clientId) {
        return NextResponse.json(
          { error: 'Google Client ID ไม่ได้ตั้งค่า กรุณาตั้งค่า GOOGLE_CLIENT_ID ใน environment variables' },
          { status: 500 }
        );
      }

      const oauth2Client = new google.auth.OAuth2(
        clientId,
        process.env.GOOGLE_CLIENT_SECRET,
        redirectUri
      );

      const scopes = [
        'https://www.googleapis.com/auth/youtube.upload',
        'https://www.googleapis.com/auth/youtube.readonly'
      ];

      const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: scopes,
        prompt: 'consent',
        state: returnTo,
      });
      
      console.log('Redirecting to OAuth URL:', authUrl);
      
      // Redirect to Google OAuth
      return NextResponse.redirect(authUrl);
    }

    return NextResponse.json({ error: 'Invalid action parameter. Use ?action=login' }, { status: 400 });
  } catch (error) {
    console.error('YouTube OAuth error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในระบบ OAuth: ' + (error as Error).message },
      { status: 500 }
    );
  }
} 