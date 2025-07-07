import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

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
      const clientId = process.env.GOOGLE_CLIENT_ID;
      
      if (!clientId) {
        return NextResponse.json({ error: 'Google OAuth not configured' }, { status: 500 });
      }

      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(
        process.env.NEXT_PUBLIC_BASE_URL + '/api/auth/youtube/callback'
      )}&response_type=code&scope=https://www.googleapis.com/auth/youtube.upload&access_type=offline&prompt=consent`;

      redirect(authUrl);
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