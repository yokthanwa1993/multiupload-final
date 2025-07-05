import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { Buffer } from 'buffer';
import { cookies } from 'next/headers';
import { Readable } from 'stream';

// This forces the route to be dynamic, which is a good practice for auth-related routes.
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // Using the same cookie reading method as the working status API route
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('youtube_access_token')?.value;
    const refreshToken = cookieStore.get('youtube_refresh_token')?.value;

    if (!accessToken || !refreshToken) {
      console.error('YouTube Auth Cookies not found using cookies() in API route.');
      return NextResponse.json({ error: 'Not authenticated with YouTube. Cookies missing.' }, { status: 401 });
    }

    // Initialize Google OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    
    // The googleapis library automatically handles token refreshing.
    // We can also listen for the 'tokens' event if we need to save the new token,
    // but for now, we'll let the library manage it for this request.
    
    // Parse form data
    const formData = await request.formData();
    const videoFile = formData.get('videoFile') as File | null;
    const thumbnailFile = formData.get('thumbnailFile') as File | null;
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
      const publishTime = new Date(publishAt);
      publishAtISO = publishTime.toISOString();
    }

    // Initialize YouTube API
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

    return NextResponse.json({
      success: true,
      videoId: videoId,
      videoUrl: videoUrl,
      message: `YouTube: ${isScheduled ? 'ตั้งเวลาสำเร็จ!' : 'อัปโหลดสำเร็จ!'} <a href="${videoUrl}" target="_blank">ดูวิดีโอ</a>`,
      yt_url: videoUrl,
      is_scheduled: isScheduled,
      publish_at: publishAt || null
    });

  } catch (error: any) {
    console.error('YouTube upload error:', error);
    
    // Handle specific YouTube API errors
    if (error.response?.data?.error?.message) {
      const errorMessage = error.response.data.error.message;
      if (errorMessage.includes('expired')) {
        return NextResponse.json({ error: 'YouTube token has expired. Please reconnect.' }, { status: 401 });
      }
      return NextResponse.json({ error: `YouTube API Error: ${errorMessage}` }, { status: 400 });
    }
    
    if (error.code === 401) {
      return NextResponse.json({ error: 'YouTube authentication expired. Please reconnect.' }, { status: 401 });
    }

    return NextResponse.json({ error: 'YouTube: ' + (error.message || 'An unknown error occurred') }, { status: 500 });
  }
} 