"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/app/context/AuthContext';

// --- Interfaces ---
interface YouTubeChannel {
  name: string;
  pfp: string;
}
interface FacebookPage {
  id: string;
  name: string;
  access_token: string;
  category: string;
}
interface UploadClientProps {
  initialYoutubeChannel: YouTubeChannel | null;
  initialFacebookPage: FacebookPage | null;
}
interface UploadResult {
    platform: 'facebook' | 'youtube';
    status: 'success' | 'error';
    url?: string;
    message?: string;
}

// --- Component ---
export default function UploadClient({ initialYoutubeChannel, initialFacebookPage }: UploadClientProps) {
  const { user } = useAuth();

  const [youtubeChannel, setYoutubeChannel] = useState(initialYoutubeChannel);
  const [facebookPage, setFacebookPage] = useState(initialFacebookPage);
  
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [description, setDescription] = useState('');
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState('');
  const [uploadResults, setUploadResults] = useState<UploadResult[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [schedulePost, setSchedulePost] = useState(false);
  const [publishAt, setPublishAt] = useState('');

  useEffect(() => {
    setYoutubeChannel(initialYoutubeChannel);
    setFacebookPage(initialFacebookPage);
  }, [initialYoutubeChannel, initialFacebookPage]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const { data } = event;
      if (data.type === 'facebook-connected' && data.page) setFacebookPage(data.page);
      if (data.type === 'youtube-connected' && data.channel) setYoutubeChannel(data.channel);
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleYouTubeLogin = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!user) return;
    const statePayload = JSON.stringify({ uid: user.uid });
    const oauthUrl = `/api/auth/youtube?state=${encodeURIComponent(statePayload)}`;
    const width = 860, height = 700;
    const left = (window.screen.width / 2) - (width / 2);
    const top = (window.screen.height / 2) - (height / 2);
    window.open(oauthUrl, '_blank', `width=${width},height=${height},top=${top},left=${left}`);
  };
  
  const handleFacebookConnect = () => {
    if(!user) return;
    const facebookUrl = `/facebook`;
    const width = 860, height = 700;
    const left = (window.screen.width / 2) - (width / 2);
    const top = (window.screen.height / 2) - (height / 2);
    window.open(facebookUrl, '_blank', `width=${width},height=${height},top=${top},left=${left}`);
  };

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDescription(e.target.value);
  };

  const handleScheduleToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSchedulePost(e.target.checked);
  };

  const handlePublishAtChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPublishAt(e.target.value);
  }

  const truncateFileName = (fileName: string, maxLength: number = 30) => {
    if (fileName.length <= maxLength) return fileName;
    
    const extension = fileName.split('.').pop();
    const nameWithoutExt = fileName.slice(0, fileName.lastIndexOf('.'));
    const truncatedName = nameWithoutExt.slice(0, maxLength - extension!.length - 4) + '...';
    
    return `${truncatedName}.${extension}`;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, fileType: 'video' | 'thumbnail') => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (fileType === 'video') {
        setVideoFile(file);
      } else {
        setThumbnailFile(file);
        const reader = new FileReader();
        reader.onloadend = () => setThumbnailPreview(reader.result as string);
        reader.readAsDataURL(file);
      }
    }
  };

  const handleDragEvents = (e: React.DragEvent<HTMLDivElement>, isDragging: boolean) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(isDragging);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, fileType: 'video' | 'thumbnail') => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      const mockEvent = { target: { files: [file] } } as unknown as React.ChangeEvent<HTMLInputElement>;
      handleFileChange(mockEvent, fileType);
    }
  };

  const copyToClipboard = (text: string, buttonElement: HTMLButtonElement) => {
    navigator.clipboard.writeText(text).then(() => {
      const originalHTML = buttonElement.innerHTML;
      buttonElement.innerHTML = '✅ Copied!';
      buttonElement.classList.add('copied');
      
      setTimeout(() => {
        buttonElement.innerHTML = originalHTML;
        buttonElement.classList.remove('copied');
      }, 2500);
    });
  };

  const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!user) {
        alert("Authentication error. Please log in again.");
        return;
    }
    if (!videoFile || !description.trim()) {
      alert('Please select a video file and enter a description.');
      return;
    }

    if (schedulePost && publishAt) {
      const selectedDate = new Date(publishAt);
      const now = new Date();
      now.setMinutes(now.getMinutes() + 15);
      
      if (selectedDate <= now) {
        alert('Scheduled time must be at least 15 minutes in the future');
        return;
      }
    }

    // Clear previous results and start uploading
    setUploadResults([]);
    setIsUploading(true);
    setUploadProgress(0);
    setUploadStatus('Authenticating...');

    try {
        const idToken = await user.getIdToken();
        const authHeader = { 'Authorization': `Bearer ${idToken}` };
        const formData = new FormData();
        formData.append('video', videoFile);
        if (thumbnailFile) formData.append('thumbnail', thumbnailFile);
        formData.append('description', description);
        formData.append('schedulePost', schedulePost.toString());
        if (publishAt) formData.append('publishAt', publishAt);

        const finalResults: UploadResult[] = [];

        // --- Facebook Upload ---
        if (facebookPage) {
            setUploadProgress(10);
            setUploadStatus('Uploading to Facebook Reels...');
            const fbResponse = await fetch('/api/upload/facebook', {
                method: 'POST',
                headers: authHeader, // Send auth token
                body: formData,
            });
            const fbResult = await fbResponse.json();

            if (!fbResponse.ok) {
                finalResults.push({ platform: 'facebook', status: 'error', message: fbResult.error || 'Upload failed' });
            } else {
                finalResults.push({ platform: 'facebook', status: 'success', url: fbResult.fb_url });
            }
            setUploadResults(finalResults);
        }

        // --- YouTube Upload ---
        if (youtubeChannel) {
            setUploadProgress(50);
            setUploadStatus('Uploading to YouTube Shorts...');
             const ytResponse = await fetch('/api/upload/youtube', {
                method: 'POST',
                headers: authHeader, // Send auth token
                body: formData, // FormData can be reused
            });
            const ytResult = await ytResponse.json();
            if (!ytResponse.ok) {
                finalResults.push({ platform: 'youtube', status: 'error', message: ytResult.error || 'Upload failed' });
            } else {
                finalResults.push({ platform: 'youtube', status: 'success', url: ytResult.yt_url });
            }
            setUploadResults(finalResults);
        }

        setUploadProgress(100);
        setUploadStatus('All uploads processed!');

    } catch (error) {
      const message = error instanceof Error ? error.message : 'An unknown error occurred';
      setUploadStatus('Upload failed: ' + message);
      setIsUploading(false); // Also stop loading on failure
    } finally {
        // This setTimeout only resets the form, not the results.
        setTimeout(() => {
            setIsUploading(false);
            setVideoFile(null);
            setThumbnailFile(null);
            setDescription('');
            setSchedulePost(false);
            setPublishAt('');
            setThumbnailPreview(null);
            setUploadProgress(0);
            setUploadStatus('');
        }, 5000);
    }
  };

  const showConnectButton = !!user;

  return (
    <>
      <div className="status-bar">
        <div className={`platform-status-container facebook-status ${facebookPage ? 'status-online' : 'status-offline'}`}>
          <span className="platform-name">REELS</span>
          {!facebookPage && showConnectButton && <button onClick={handleFacebookConnect} className="connect-link">Connect</button>}
        </div>
        <div className="status-divider"></div>
        <div className={`platform-status-container youtube-status ${youtubeChannel ? 'status-online' : 'status-offline'}`}>
          <span className="platform-name">SHORTS</span>
          {!youtubeChannel && showConnectButton && <button onClick={handleYouTubeLogin} className="connect-link">Connect</button>}
        </div>
      </div>
      <div className="glass-container">
        {/* Upload Results - Above Form */}
        {uploadResults.length > 0 && (
          <div className="upload-results-top">
            <div className="results-header">
              <div className="results-icon">📊</div>
              <div>Upload Results</div>
            </div>
            <div className="results-body">
              {uploadResults.map((result, index) => (
                <div key={index} className={`platform-row ${result.status === 'success' ? (result.platform === 'facebook' ? 'facebook-row' : 'youtube-row') : 'error-row'}`}>
                  <div className="platform-info">
                    <div className={`platform-icon-large ${result.platform === 'facebook' ? 'facebook-icon-large' : 'youtube-icon-large'}`}>
                      {result.platform === 'facebook' ? '📘' : '📺'}
                    </div>
                    <div className="platform-details">
                      <div className="platform-name-large">
                        {result.platform === 'facebook' ? 'Facebook Reels' : 'YouTube Shorts'}
                      </div>
                      <div className="platform-description" style={{ color: result.status === 'success' ? 'var(--text-secondary)' : 'var(--error)' }}>
                        {result.status === 'success' 
                          ? `Your video is now live on ${result.platform === 'facebook' ? 'Facebook Reels' : 'YouTube Shorts'}`
                          : result.message
                        }
                      </div>
                    </div>
                  </div>
                  {result.status === 'success' ? (
                    <>
                      <div className="platform-status-large">
                        <div className="status-icon">✅</div>
                        <div>Success</div>
                      </div>
                      <div className="link-section">
                        <a href={result.url} target="_blank" rel="noopener noreferrer" className="view-link">
                          🔗 {result.platform === 'facebook' ? 'View Reel' : 'View Short'}
                        </a>
                        <button 
                          className="copy-button-large" 
                          onClick={(e) => copyToClipboard(result.url!, e.currentTarget)}
                        >
                          📋 Copy Link
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="platform-status-large status-failed">
                      <div className="status-icon">❌</div>
                      <div>Failed</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <form id="uploadForm" className="form-container" method="POST" encType="multipart/form-data" onSubmit={handleFormSubmit}>
            <div 
              className={`image-preview-section ${isDragging ? 'dragging' : ''}`}
              onDragOver={(e) => handleDragEvents(e, true)}
              onDragLeave={(e) => handleDragEvents(e, false)}
              onDrop={(e) => handleDrop(e, 'thumbnail')}
            >
                <div id="image-drop-zone" onClick={() => document.getElementById('thumbnail_file')?.click()}>
                    {thumbnailPreview ? (
                        <img id="thumbnail-preview" src={thumbnailPreview} alt="Thumbnail Preview" style={{width: '100%', height: '100%', objectFit: 'cover' }}/>
                    ) : (
                        youtubeChannel ? (
                          <div className="channel-placeholder">
                            <img src={youtubeChannel.pfp} alt={youtubeChannel.name} className="logo-image-center"/>
                            <p className="channel-name">{youtubeChannel.name}</p>
                            <p className="channel-prompt">อัปโหลดภาพปกสำหรับวิดีโอนี้</p>
                          </div>
                        ) : (
                          <div className="disconnected-placeholder">
                            <div className="disconnected-icon">
                                <svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/><line x1="2" y1="2" x2="22" y2="22"/></svg>
                            </div>
                            <p className="disconnected-text">Not Connected to YouTube</p>
                            <p className="disconnected-subtext">Connect YouTube to see your channel</p>
                          </div>
                        )
                    )}
                </div>
                <input type="file" name="thumbnail_file" id="thumbnail_file" accept="image/jpeg,image/png" style={{display: "none"}} onChange={(e) => handleFileChange(e, 'thumbnail')} />
            </div>

            <div className="form-section">
                <div className="form-group">
                    <label htmlFor="video_file" className="form-label">Select Video File (MP4)</label>
                    <div 
                      id="video-drop-zone" 
                      className={`file-drop-zone ${isDragging ? 'dragging' : ''}`}
                      onDragOver={(e) => handleDragEvents(e, true)}
                      onDragLeave={(e) => handleDragEvents(e, false)}
                      onDrop={(e) => handleDrop(e, 'video')}
                      onClick={() => document.getElementById('video_file')?.click()}
                      style={{ cursor: 'pointer' }}
                    >
                        <span id="video-file-name">{videoFile ? truncateFileName(videoFile.name) : 'Choose File | No file chosen'}</span>
                    </div>
                    <input type="file" name="video_file" id="video_file" required accept="video/mp4,video/quicktime" style={{display: "none"}} onChange={(e) => handleFileChange(e, 'video')} />
                </div>

                <div className="form-group">
                    <label htmlFor="description" className="form-label">Title / Description</label>
                    <textarea 
                        id="description" 
                        name="description" 
                        className="form-input" 
                        rows={5} 
                        placeholder="Enter your video description..."
                        value={description}
                        onChange={handleDescriptionChange}
                    ></textarea>
                    <div id="char-counter" className="char-counter">{description.length}/2200</div>
                </div>

                <div className="form-group">
                    <label className="form-label">Auto Hashtags</label>
                    <div className="auto-hashtags">
                        <p><strong>For Reels:</strong> #เล่าเรื่อง #คลิปไวรัล #reels #viralvideo</p>
                        <p><strong>For Shorts:</strong> #เล่าเรื่อง #คลิปไวรัล #viralvideo #shorts</p>
                    </div>
                </div>

                <div className="form-group schedule-group">
                    <label className="form-label">Schedule Post</label>
                    <div className="schedule-toggle-wrapper">
                         <input 
                            type="checkbox" 
                            id="schedule_post" 
                            name="schedule_post"
                            checked={schedulePost}
                            onChange={handleScheduleToggle}
                         />
                         <label htmlFor="schedule_post" className="toggle-switch"></label>
                         {schedulePost && (
                           <input 
                                type="datetime-local" 
                                id="publish_at" 
                                name="publish_at" 
                                className="form-input" 
                                value={publishAt}
                                onChange={handlePublishAtChange}
                                style={{ minHeight: 'auto' }}
                            />
                         )}
                    </div>
                </div>

                <button type="submit" id="uploadButton" className="btn btn-primary" disabled={isUploading}>
                    {isUploading ? (
                      <>
                        <div className="loading"></div>
                        <span>Uploading...</span>
                      </>
                    ) : (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-rocket"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></svg>
                        <span>🚀 Launch to All Platforms</span>
                      </>
                    )}
                </button>
            </div>
        </form>

        {/* Progress Container - Only for loading */}
        {(isUploading || uploadStatus) && (
          <div id="progress-container" className="progress-container-inline">
              <div className="progress-bar-wrapper">
                  <div id="progress-bar" className="progress-bar" style={{width: `${uploadProgress}%`}}></div>
              </div>
              <div id="progress-text" className="progress-text">{uploadStatus}</div>
              <div id="status-log" className="status-log"></div>
          </div>
        )}
      </div>
    </>
  );
} 