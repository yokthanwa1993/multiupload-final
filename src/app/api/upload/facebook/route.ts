import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { adminAuth } from '@/app/lib/firebase-admin';

async function getUserIdFromRequest(req: NextRequest): Promise<string | null> {
    const authorization = req.headers.get('Authorization');
    if (authorization?.startsWith('Bearer ')) {
        const idToken = authorization.split('Bearer ')[1];
        try {
            if (!adminAuth) throw new Error('Firebase Admin is not initialized');
            const decodedToken = await adminAuth.verifyIdToken(idToken);
            return decodedToken.uid;
        } catch (_error) {
            console.error("Error verifying ID token:", _error);
            return null; 
        }
    }
    return null;
}

function getFacebookTokenData(uid: string) {
  const dataDir = process.env.NODE_ENV === 'production' ? '/app/data' : process.cwd();
  const TOKEN_PATH = path.join(dataDir, `${uid}_facebook_token.json`);

  if (!fs.existsSync(TOKEN_PATH)) {
    throw new Error('Facebook page not connected for this user.');
  }
  const tokenData = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'));
  
  if (!tokenData.id || !tokenData.access_token) {
      throw new Error('Invalid Facebook token file. Please reconnect the page.');
  }
  return { pageId: tokenData.id, accessToken: tokenData.access_token };
}

export async function POST(request: NextRequest) {
  try {
    const uid = await getUserIdFromRequest(request);
    if (!uid) {
        return NextResponse.json({ error: 'Unauthorized user.' }, { status: 401 });
    }

    const { pageId, accessToken } = getFacebookTokenData(uid);
    
    const formData = await request.formData();
    const videoFile = formData.get('video') as File;
    const thumbnailFile = formData.get('thumbnail') as File | null;
    const description = formData.get('description') as string || '';
    const schedulePost = formData.get('schedulePost') as string;
    const publishAt = formData.get('publishAt') as string;

    if (!videoFile) {
      return NextResponse.json({ error: 'Video file is required' }, { status: 400 });
    }

    // Add standard hashtags if not already present
    const reelsHashtags = '#เล่าเรื่อง #คลิปไวรัล #reels #viralvideo';
    const baseHashtags = reelsHashtags.split(' ');
    const hashtagsToAppend = [];
    
    for (const tag of baseHashtags) {
      if (!description.includes(tag)) {
        hashtagsToAppend.push(tag);
      }
    }
    
    let fbDescription = description;
    if (hashtagsToAppend.length > 0) {
      fbDescription += ' ' + hashtagsToAppend.join(' ');
    }
    fbDescription = fbDescription.trim();

    // Handle scheduling
    let scheduledTimestamp = null;
    const isScheduled = schedulePost === 'true' && publishAt;
    
    if (isScheduled) {
      const publishTime = new Date(publishAt);
      const now = new Date();
      now.setMinutes(now.getMinutes() + 15); // Add 15 minutes buffer
      
      if (publishTime <= now) {
        return NextResponse.json({ 
          error: 'เวลาที่ตั้งต้องเป็นอนาคตอย่างน้อย 15 นาที' 
        }, { status: 400 });
      }
      
      scheduledTimestamp = Math.floor(publishTime.getTime() / 1000);
    }

    // Convert files to buffers
    const videoBuffer = Buffer.from(await videoFile.arrayBuffer());
    const thumbnailBuffer = thumbnailFile ? Buffer.from(await thumbnailFile.arrayBuffer()) : null;

    // Upload to Facebook Reels
    const reelUrl = await uploadToFacebookReel(
      pageId,
      accessToken,
      videoBuffer,
      thumbnailBuffer,
      fbDescription,
      scheduledTimestamp
    );

    return NextResponse.json({
      success: true,
      message: `Facebook Reels: ${isScheduled ? 'ตั้งเวลาสำเร็จ!' : 'อัปโหลดสำเร็จ!'} <a href="${reelUrl}" target="_blank">ดู Reel</a>`,
      fb_url: reelUrl,
      description: fbDescription,
      is_scheduled: isScheduled,
      publish_at: publishAt || null
    });

  } catch (_error) {
    console.error('Error in Facebook upload POST handler:', _error);
    const message = _error instanceof Error ? _error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function uploadToFacebookReel(
  pageId: string,
  accessToken: string,
  videoBuffer: Buffer,
  thumbnailBuffer: Buffer | null,
  description: string,
  scheduledTimestamp: number | null = null
): Promise<string> {
  const FACEBOOK_GRAPH_API_URL = 'https://graph.facebook.com/v19.0/';
  const baseUrl = `${FACEBOOK_GRAPH_API_URL}${pageId}/video_reels`;
  
  // Step 1a: Initialize upload
  const initUrl = `${baseUrl}?upload_phase=start&access_token=${accessToken}`;
  
  const initResponse = await fetch(initUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  
  if (!initResponse.ok) {
    const errorData = await initResponse.json();
    throw new Error(`FB Init Failed (HTTP ${initResponse.status}): ${errorData.error?.message || 'Unknown error'}`);
  }
  
  const initData = await initResponse.json();
  if (!initData.video_id) {
    throw new Error('FB Init Failed: No video_id received');
  }
  
  const videoId = initData.video_id;
  const uploadUrl = initData.upload_url;
  
  // Step 1b: Upload video
  const uploadResponse = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Authorization': `OAuth ${accessToken}`,
      'Offset': '0',
      'File_Size': videoBuffer.length.toString(),
      'Content-Type': 'application/octet-stream',
    },
    body: videoBuffer,
  });
  
  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text();
    throw new Error(`FB Upload Failed: ${errorText}`);
  }
  
  // Step 1c: Finish upload
  const finishParams = new URLSearchParams({
    video_id: videoId,
    upload_phase: 'finish',
    description: description,
    access_token: accessToken,
  });
  
  if (scheduledTimestamp) {
    finishParams.append('video_state', 'SCHEDULED');
    finishParams.append('scheduled_publish_time', scheduledTimestamp.toString());
  } else {
    finishParams.append('video_state', 'PUBLISHED');
  }
  
  const finishUrl = `${baseUrl}?${finishParams.toString()}`;
  const finishResponse = await fetch(finishUrl, {
    method: 'POST',
  });
  
  if (!finishResponse.ok) {
    const errorText = await finishResponse.text();
    throw new Error(`FB Finish Failed: ${errorText}`);
  }
  
  const finishData = await finishResponse.json();
  if (!finishData.success && !finishData.post_id) {
    throw new Error('FB Publish command did not succeed');
  }
  
  // Step 2: Wait for processing
  let isReady = false;
  for (let i = 0; i < 24; i++) {
    const statusUrl = `${FACEBOOK_GRAPH_API_URL}${videoId}?fields=status&access_token=${accessToken}`;
    
    const statusResponse = await fetch(statusUrl);
    if (statusResponse.ok) {
      const statusData = await statusResponse.json();
      if (statusData.status?.video_status === 'ready') {
        isReady = true;
        break;
      }
    }
    
    // Wait 5 seconds before checking again
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  
  if (!isReady) {
    throw new Error('วิดีโอใช้เวลาประมวลผลนานเกินไป');
  }
  
  // Step 3: Set thumbnail (if provided)
  if (thumbnailBuffer) {
    try {
      const thumbnailUrl = `${FACEBOOK_GRAPH_API_URL}${videoId}/thumbnails`;
      const thumbnailFormData = new FormData();
      thumbnailFormData.append('access_token', accessToken);
      thumbnailFormData.append('source', new Blob([thumbnailBuffer]), 'thumbnail.jpg');
      thumbnailFormData.append('is_preferred', 'true');
      
      await fetch(thumbnailUrl, {
        method: 'POST',
        body: thumbnailFormData,
      });
    } catch (thumbnailError) {
      console.error('Failed to upload thumbnail:', thumbnailError);
      // Continue even if thumbnail upload fails
    }
  }
  
  return `https://www.facebook.com/reel/${videoId}`;
} 