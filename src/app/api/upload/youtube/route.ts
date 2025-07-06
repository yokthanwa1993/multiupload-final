import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { Buffer } from 'buffer';
import { Readable } from 'stream';
import { getAuthenticatedClient } from '../../../lib/youtube-auth';

// This forces the route to be dynamic, which is a good practice for auth-related routes.
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // Get an authenticated client, which handles tokens automatically
    const oauth2Client = await getAuthenticatedClient();
    
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

  } catch (error: any) {
    console.error('YouTube upload error:', error);
    
    // Handle specific errors
    if (error.message.includes('Token file not found') || error.message.includes('Refresh token is missing')) {
      return NextResponse.json({ error: 'Authentication required. Please connect to YouTube.' }, { status: 401 });
    }

    if (error.response?.data?.error?.message) {
      const errorMessage = error.response.data.error.message;
      return NextResponse.json({ error: `YouTube API Error: ${errorMessage}` }, { status: 400 });
    }
    
    return NextResponse.json({ 
      error: 'YouTube: ' + (error.message || 'An unknown error occurred') 
    }, { status: 500 });
  }
} 