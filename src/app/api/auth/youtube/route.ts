import { NextResponse } from 'next/server';
import { redirect } from 'next/navigation';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const action = url.searchParams.get('action');
  
  if (action === 'login') {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

    if (!clientId || !baseUrl) {
      return NextResponse.json({ error: 'Google OAuth or Base URL not configured' }, { status: 500 });
    }

    const redirectUri = `${baseUrl}/api/auth/youtube/callback`;
    const scopes = [
      'https://www.googleapis.com/auth/youtube.upload',
      'https://www.googleapis.com/auth/youtube.readonly'
    ].join(' ');

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&response_type=code&scope=${encodeURIComponent(scopes)}&access_type=offline&prompt=consent`;

    redirect(authUrl);
  }
  
  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
} 