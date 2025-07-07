import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const dataDir = process.env.NODE_ENV === 'production' ? '/app/data' : process.cwd();
const TOKEN_PATH = path.join(dataDir, 'facebook-token.json');

// Ensure the data directory exists
if (process.env.NODE_ENV === 'production' && !fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

export async function POST(req: NextRequest) {
  try {
    const pageData = await req.json();
    if (!pageData.id || !pageData.access_token) {
      return NextResponse.json({ error: 'Invalid page data provided.' }, { status: 400 });
    }

    // Write the token data to the file
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(pageData, null, 2));
    
    return NextResponse.json({ message: 'Token saved successfully.' }, { status: 200 });
  } catch (error) {
    console.error('Error saving Facebook token:', error);
    return NextResponse.json({ error: 'Failed to save token.' }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    // Check if the file exists before trying to delete
    if (fs.existsSync(TOKEN_PATH)) {
      fs.unlinkSync(TOKEN_PATH);
    }
    return NextResponse.json({ message: 'Token deleted successfully.' }, { status: 200 });
  } catch (error) {
    console.error('Error deleting Facebook token:', error);
    return NextResponse.json({ error: 'Failed to delete token.' }, { status: 500 });
  }
}

export async function GET() {
    try {
        if (fs.existsSync(TOKEN_PATH)) {
            const tokenData = fs.readFileSync(TOKEN_PATH, 'utf-8');
            return NextResponse.json(JSON.parse(tokenData), { status: 200 });
        } else {
            return NextResponse.json({ error: 'Token not found.' }, { status: 404 });
        }
    } catch (error) {
        console.error('Error fetching Facebook token:', error);
        return NextResponse.json({ error: 'Failed to fetch token.' }, { status: 500 });
    }
} 