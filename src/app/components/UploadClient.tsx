'use client';

import { useState, useEffect } from 'react';
import Image from "next/image";

interface AuthStatus {
  authenticated: boolean;
}

interface YouTubeChannel {
  name: string;
  pfp: string;
}

interface UploadClientProps {
  initialAuthStatus: boolean;
  initialYoutubeChannel: YouTubeChannel | null;
}

interface UploadResult {
  platform: 'facebook' | 'youtube';
  status: 'success' | 'error';
  url?: string;
  message?: string;
}

export default function UploadClient({ initialAuthStatus, initialYoutubeChannel }: UploadClientProps) {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [description, setDescription] = useState('');
  const [schedulePost, setSchedulePost] = useState(false);
  const [publishAt, setPublishAt] = useState('');
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState('');
  const [uploadResults, setUploadResults] = useState<UploadResult[]>([]);
  
  const [authStatus, setAuthStatus] = useState<AuthStatus>({ authenticated: initialAuthStatus });
  const [youtubeChannel, setYoutubeChannel] = useState<YouTubeChannel | null>(initialYoutubeChannel);

  useEffect(() => {
    // This effect is ONLY for handling the OAuth popup message.
    const handleAuthMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;

      const { auth, channelName, channelPfp, error } = event.data;

      if (auth === 'success') {
        setAuthStatus({ authenticated: true });
        if (channelName && channelPfp) {
          const channelInfo = { name: channelName, pfp: channelPfp };
          setYoutubeChannel(channelInfo);
          localStorage.setItem('youtubeChannel', JSON.stringify(channelInfo));
        }
      } else if (error) {
        console.error('OAuth Error:', error);
        setAuthStatus({ authenticated: false });
        setYoutubeChannel(null);
        localStorage.removeItem('youtubeChannel');
      }
    };
    
    window.addEventListener('message', handleAuthMessage);

    return () => {
      window.removeEventListener('message', handleAuthMessage);
    };
  }, []);

  const handleYouTubeLogin = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    if (authStatus.authenticated) {
      handleYouTubeLogout();
    } else {
      const oauthUrl = `/api/auth/youtube?action=login&returnTo=${encodeURIComponent(window.location.pathname)}`;
      
      // --- NEW: Center Popup Logic ---
      const width = 500;
      const height = 650;
      // Fallback to screen center if window.top is not available
      const screenLeft = window.top?.screenX ?? window.screenX;
      const screenTop = window.top?.screenY ?? window.screenY;
      const outerWidth = window.top?.outerWidth ?? window.outerWidth;
      const outerHeight = window.top?.outerHeight ?? window.outerHeight;
      
      const left = outerWidth / 2 + screenLeft - (width / 2);
      const top = outerHeight / 2 + screenTop - (height / 2);
      
      const popup = window.open(oauthUrl, '_blank', `width=${width},height=${height},top=${top},left=${left}`);
      
      const handleAuthMessage = (event: MessageEvent) => {
        // Ensure the message is from our expected origin
        if (event.origin !== window.location.origin) {
          return;
        }

        const { auth, channelName, channelPfp, error } = event.data;

        if (auth === 'success') {
          setAuthStatus({ authenticated: true });
          if (channelName && channelPfp) {
            const channelInfo = { name: channelName, pfp: channelPfp };
            setYoutubeChannel(channelInfo);
            localStorage.setItem('youtubeChannel', JSON.stringify(channelInfo));
          }
        } else if (error) {
          console.error('OAuth Error:', error);
          setAuthStatus({ authenticated: false });
          setYoutubeChannel(null);
          localStorage.removeItem('youtubeChannel');
        }

        // Clean up
        window.removeEventListener('message', handleAuthMessage);
        if (popup) popup.close();
      };

      window.addEventListener('message', handleAuthMessage, false);
    }
  };

  const handleYouTubeLogout = async () => {
    try {
      const response = await fetch('/api/auth/youtube/status', {
        method: 'DELETE',
      });
      const data = await response.json();
      if (data.success) {
        setAuthStatus({ authenticated: false });
        // NEW: Clear channel info on logout
        setYoutubeChannel(null);
        localStorage.removeItem('youtubeChannel');
      }
    } catch (error) {
      console.error('Logout failed:', error);
    }
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
        reader.onloadend = () => {
          setThumbnailPreview(reader.result as string);
        };
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
      
      const mockEvent = {
        target: { files: [file] }
      } as unknown as React.ChangeEvent<HTMLInputElement>;
      
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
    
    if (!videoFile) {
      alert('Please select a video file');
      return;
    }
    
    if (!description.trim()) {
      alert('Please enter a description');
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

    setIsUploading(true);
    setUploadProgress(0);
    setUploadStatus('Starting upload...');

    try {
      const fbFormData = new FormData();
      fbFormData.append('video', videoFile);
      if (thumbnailFile) {
        fbFormData.append('thumbnail', thumbnailFile);
      }
      fbFormData.append('description', description);
      fbFormData.append('schedulePost', schedulePost.toString());
      if (publishAt) {
        fbFormData.append('publishAt', publishAt);
      }

      setUploadProgress(20);
      setUploadStatus('Uploading to Facebook Reels...');

      const fbResponse = await fetch('/api/upload/facebook', {
        method: 'POST',
        body: fbFormData,
      });

      const fbResult = await fbResponse.json();

      if (!fbResponse.ok) {
        setUploadResults([{ platform: 'facebook', status: 'error', message: fbResult.error || 'Facebook upload failed' }]);
        throw new Error(fbResult.error || 'Facebook upload failed');
      }

      setUploadProgress(70);
      setUploadStatus('Facebook upload complete!');
      setUploadResults([{ platform: 'facebook', status: 'success', url: fbResult.fb_url }]);

      if (authStatus.authenticated) {
        setUploadProgress(80);
        setUploadStatus('Uploading to YouTube Shorts...');

        try {
          const ytFormData = new FormData();
          ytFormData.append('videoFile', videoFile);
          if (thumbnailFile) {
            ytFormData.append('thumbnailFile', thumbnailFile);
          }
          ytFormData.append('description', description);
          ytFormData.append('schedulePost', schedulePost.toString());
          if (publishAt) {
            ytFormData.append('publishAt', publishAt);
          }

          const ytResponse = await fetch('/api/upload/youtube', {
            method: 'POST',
            body: ytFormData,
            credentials: 'include',
          });

          const ytResult = await ytResponse.json();

          if (ytResponse.ok) {
            setUploadProgress(100);
            setUploadStatus('All uploads processed! 🎉');
            setUploadResults([
              { platform: 'facebook', status: 'success', url: fbResult.fb_url },
              { platform: 'youtube', status: 'success', url: ytResult.yt_url }
            ]);
          } else {
            throw new Error(ytResult.error || 'YouTube upload failed');
          }
        } catch (ytError: any) {
          let ytErrorMessage = ytError.message || 'Unknown error';
          if (ytError.message && ytError.message.includes('Not authenticated')) {
            ytErrorMessage = 'Authentication expired. Please disconnect and reconnect YouTube.';
            setAuthStatus({ authenticated: false });
          }
          setUploadProgress(100);
          setUploadStatus('Partial success - Facebook uploaded, YouTube failed');
          setUploadResults([
            { platform: 'facebook', status: 'success', url: fbResult.fb_url },
            { platform: 'youtube', status: 'error', message: ytErrorMessage }
          ]);
        }
      } else {
        setUploadProgress(100);
        setUploadStatus('Facebook upload complete! Connect YouTube to upload Shorts too');
      }
      
      // Reset form but keep results
      setTimeout(() => {
        setVideoFile(null);
        setThumbnailFile(null);
        setDescription('');
        setSchedulePost(false);
        setPublishAt('');
        setThumbnailPreview(null);
        setIsUploading(false);
        setUploadProgress(0);
        setUploadStatus('');
        // Don't reset uploadResults - keep them visible
      }, 3000);

    } catch (error: any) {
      setUploadStatus('Upload failed: ' + (error?.message || 'Unknown error'));
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  return (
    <>
        <div className="glass-container">
            <div className={`status-bar ${authStatus.authenticated ? 'status-online' : 'status-offline'}`}>
                <span>
                  {authStatus.authenticated ? 'NEURAL LINK ACTIVE' : 'NEURAL LINK INACTIVE'}
                </span>
                <a href="#" onClick={handleYouTubeLogin}>
                  {authStatus.authenticated ? 'Disconnect' : 'Connect YouTube'}
                </a>
            </div>

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
                          <img id="thumbnail-preview" src={thumbnailPreview} alt="Thumbnail Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
                        ) : (
                          <>
                            {authStatus.authenticated && youtubeChannel ? (
                              <div className="channel-placeholder">
                                <img 
                                  src={youtubeChannel.pfp} 
                                  alt={youtubeChannel.name} 
                                  className="logo-image-center"
                                  onError={(e) => {
                                    e.currentTarget.src = '/logo.png';
                                  }}
                                />
                                <p className="channel-name">{youtubeChannel.name}</p>
                                <p className="channel-prompt">อัปโหลดภาพปกสำหรับวิดีโอนี้</p>
                              </div>
                            ) : (
                              <>
                                <img
                                  src="/logo.png"
                                  alt="Page Logo"
                                  className="logo-image-center"
                                />
                                <p>Drag & Drop Thumbnail<br/>or click to browse<br/><small style={{ opacity: 0.7 }}>JPG, PNG, GIF supported</small></p>
                              </>
                            )}
                          </>
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