import { NextResponse } from 'next/server';
import { redirect } from 'next/navigation';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const action = url.searchParams.get('action');
  
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
  
  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
} 