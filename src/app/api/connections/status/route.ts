import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/app/lib/firebase-admin';
import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';

async function getUserIdFromRequest(req: NextRequest): Promise<string | null> {
    const authorization = req.headers.get('Authorization');
    if (authorization?.startsWith('Bearer ')) {
        const idToken = authorization.split('Bearer ')[1];
        try {
            const decodedToken = await adminAuth.verifyIdToken(idToken);
            return decodedToken.uid;
        } catch (error) {
            console.error("Error verifying ID token:", error);
            return null;
        }
    }
    return null;
}

async function getYoutubeChannel(uid: string, dataDir: string) {
    const tokenPath = path.join(dataDir, `${uid}_youtube_token.json`);
    if (!fs.existsSync(tokenPath)) return null;

    try {
        const tokenData = JSON.parse(fs.readFileSync(tokenPath, 'utf-8'));
        const oauth2Client = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
        oauth2Client.setCredentials(tokenData);
        const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
        const channelRes = await youtube.channels.list({ part: ['snippet'], mine: true });
        const channel = channelRes.data.items?.[0];

        if (!channel) throw new Error("Could not fetch YouTube channel info.");

        return {
            name: channel.snippet?.title || 'YouTube Channel',
            pfp: channel.snippet?.thumbnails?.default?.url || '/youtube-logo.png'
        };
    } catch (error) {
        console.error(`Invalid YouTube token for user ${uid}, deleting.`);
        fs.unlinkSync(tokenPath);
        return null;
    }
}

async function getFacebookPage(uid: string, dataDir: string) {
    const tokenPath = path.join(dataDir, `${uid}_facebook_token.json`);
    if (!fs.existsSync(tokenPath)) return null;

    try {
        const tokenData = JSON.parse(fs.readFileSync(tokenPath, 'utf-8'));
        // A simple validation might be needed here as well in a real app
        return tokenData;
    } catch (error) {
        console.error(`Invalid Facebook token for user ${uid}, deleting.`);
        fs.unlinkSync(tokenPath);
        return null;
    }
}

export async function GET(req: NextRequest) {
    const uid = await getUserIdFromRequest(req);
    if (!uid) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const dataDir = process.env.NODE_ENV === 'production' ? '/app/data' : process.cwd();
    
    const [youtubeChannel, facebookPage] = await Promise.all([
        getYoutubeChannel(uid, dataDir),
        getFacebookPage(uid, dataDir)
    ]);

    return NextResponse.json({
        youtube: { channel: youtubeChannel },
        facebook: { page: facebookPage }
    });
} 