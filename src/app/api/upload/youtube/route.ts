import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { Buffer } from 'buffer';
import { Readable } from 'stream';
import { adminAuth } from '@/app/lib/firebase-admin';
import { getToken, setToken } from '@/app/lib/realtimedb-tokens';

// This forces the route to be dynamic, which is a good practice for auth-related routes.
export const dynamic = 'force-dynamic';

// Helper to get UID from request
async function getUserIdFromRequest(req: NextRequest): Promise<string | null> {
    const authorization = req.headers.get('Authorization');
    if (authorization?.startsWith('Bearer ')) {
        const idToken = authorization.split('Bearer ')[1];
        try {
            if (!adminAuth) throw new Error('Firebase Admin is not initialized');
            const decodedToken = await adminAuth.verifyIdToken(idToken);
            return decodedToken.uid;
        } catch (_error) {
            console.error("Error verifying ID token in youtube/upload:", _error);
            return null; 
        }
    }
    return null;
}

// Helper to get an authenticated OAuth2 client for a specific user
async function getUserYoutubeClient(uid: string) {
    const tokenData = await getToken(uid, 'youtube');

    if (!tokenData) {
        throw new Error('YouTube not connected for this user. Please connect it first.');
    }

    const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET
    );
    oauth2Client.setCredentials(tokenData);
    
    // Add an event listener to handle token refreshes.
    // If a new access token is automatically fetched, this event will fire.
    oauth2Client.on('tokens', async (newTokens) => {
        console.log(`YouTube token for user ${uid} was refreshed.`);
        // The new response might not include a refresh token, so we merge it with the old one.
        if (!newTokens.refresh_token && tokenData.refresh_token) {
            newTokens.refresh_token = tokenData.refresh_token;
        }
        // Save the updated (or merged) tokens back to the database.
        await setToken(uid, 'youtube', newTokens);
        console.log(`Refreshed token for user ${uid} saved to Firestore.`);
    });

    return oauth2Client;
}

export async function POST(request: NextRequest) {
  try {
    const uid = await getUserIdFromRequest(request);
    if (!uid) {
        return NextResponse.json({ error: 'Unauthorized user.' }, { status: 401 });
    }

    const oauth2Client = await getUserYoutubeClient(uid);
    
    const formData = await request.formData();
    // Correctly get files using the keys sent from the client
    const videoFile = formData.get('video') as File | null;
    const thumbnailFile = formData.get('thumbnail') as File | null;
    const description = formData.get('description') as string || '';
    const schedulePost = formData.get('schedulePost') as string;
    const publishAt = formData.get('publishAt') as string;

    if (!videoFile) {
      return NextResponse.json({ error: 'Video file is required' }, { status: 400 });
    }

    // Add YouTube Shorts hashtags
    const shortsHashtags = '#เล่าเรื่อง #คลิปไวรัล #viralvideo #shorts';
    const ytDescription = description + ' ' + shortsHashtags;
    
    // Create title from description (max 100 chars)
    const finalTitle = description.length > 100 ? description.substring(0, 100) : description || 'Untitled Video';

    // Handle scheduling
    let publishAtISO = null;
    const isScheduled = schedulePost === 'true' && publishAt;
    
    if (isScheduled) {
      // The 'publishAt' from the client is already in ISO format.
      publishAtISO = publishAt;
    }

    // Initialize YouTube API with the authenticated client
    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

    // Convert video file into a buffer, then a readable stream
    const videoBuffer = Buffer.from(await videoFile.arrayBuffer());
    const videoStream = new Readable();
    videoStream.push(videoBuffer);
    videoStream.push(null); // Signals the end of the stream

    // Prepare video metadata
    const videoMetadata = {
      snippet: {
        title: finalTitle,
        description: ytDescription,
        categoryId: '22', // People & Blogs category
      },
      status: {
        privacyStatus: isScheduled ? 'private' : 'public',
        publishAt: publishAtISO || undefined,
      },
    };

    // Upload video to YouTube
    const uploadResponse = await youtube.videos.insert({
      part: ['snippet', 'status'],
      requestBody: videoMetadata,
      media: {
        body: videoStream,
      },
    });

    const videoId = uploadResponse.data.id;

    if (!videoId) {
      throw new Error('YouTube: ไม่ได้รับ Video ID ที่สมบูรณ์');
    }

    // Upload custom thumbnail if provided
    if (thumbnailFile && videoId) {
      try {
        // Thumbnail upload also expects a stream
        const thumbnailBuffer = Buffer.from(await thumbnailFile.arrayBuffer());
        const thumbnailStream = new Readable();
        thumbnailStream.push(thumbnailBuffer);
        thumbnailStream.push(null);

        await youtube.thumbnails.set({
          videoId: videoId,
          media: {
            body: thumbnailStream,
          },
        });
      } catch (thumbnailError) {
        console.error('Failed to upload thumbnail:', thumbnailError);
        // Continue even if thumbnail upload fails
      }
    }

    const videoUrl = `https://www.youtube.com/shorts/${videoId}`;

    // No need to manage cookies or tokens here anymore
    return NextResponse.json({
      success: true,
      videoId: videoId,
      videoUrl: videoUrl,
      message: `YouTube: ${isScheduled ? 'ตั้งเวลาสำเร็จ!' : 'อัปโหลดสำเร็จ!'} <a href="${videoUrl}" target="_blank">ดูวิดีโอ</a>`,
      yt_url: videoUrl,
      is_scheduled: isScheduled,
      publish_at: publishAt || null
    });

  } catch (_error) {
    console.error('Error in YouTube upload POST handler:', _error);
    const message = _error instanceof Error ? _error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
} 