import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const dataDir = process.env.NODE_ENV === 'production' ? '/app/data' : process.cwd();
const TOKEN_PATH = path.join(dataDir, 'token.json');

// Force dynamic execution to prevent caching
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    if (fs.existsSync(TOKEN_PATH)) {
      const tokenData = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'));
      if (tokenData.refresh_token) {
        return NextResponse.json({ authenticated: true });
      }
    }
    return NextResponse.json({ authenticated: false });
  } catch (error) {
    console.error('Status check error:', error);
    return NextResponse.json({ authenticated: false, error: 'Status check failed' }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    if (fs.existsSync(TOKEN_PATH)) {
      fs.unlinkSync(TOKEN_PATH);
      console.log('Token file deleted successfully.');
    }
    return NextResponse.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json({ success: false, error: 'Failed to logout' }, { status: 500 });
  }
}

// The refresh logic is now centralized in the library, so it's removed from here. 