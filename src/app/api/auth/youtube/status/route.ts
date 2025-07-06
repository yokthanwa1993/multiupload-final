import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Define the path for the token file
const TOKEN_PATH = path.join(process.cwd(), 'token.json');

// Force dynamic execution to prevent caching
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Check if the token file exists and contains a refresh token
    if (fs.existsSync(TOKEN_PATH)) {
      const tokenData = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'));
      if (tokenData.refresh_token) {
        return NextResponse.json({ authenticated: true });
      }
    }
    return NextResponse.json({ authenticated: false });
  } catch (error) {
    console.error('Status check error:', error);
    // If file is malformed or other errors, consider not authenticated
    return NextResponse.json({ authenticated: false, error: 'Status check failed' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // On logout, delete the token file
    if (fs.existsSync(TOKEN_PATH)) {
      fs.unlinkSync(TOKEN_PATH);
      console.log('Token file deleted successfully.');
    }
    return NextResponse.json({ success: true, message: 'ออกจากระบบเรียบร้อย' });
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json({ success: false, error: 'เกิดข้อผิดพลาดในการออกจากระบบ' }, { status: 500 });
  }
}

// The refresh logic is now centralized in the library, so it's removed from here. 