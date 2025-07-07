'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';

interface AuthStatus {
  authenticated: boolean;
  tokens?: {
    access_token: string;
    refresh_token: string;
    scope: string;
    token_type: string;
    expiry_date: number;
  };
}

export default function TestYouTube() {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [schedulePost, setSchedulePost] = useState(false);
  const [publishAt, setPublishAt] = useState('');
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState('');
  const [authStatus, setAuthStatus] = useState<AuthStatus>({ authenticated: false });
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('auth') === 'success') {
      // Clear the URL params so it doesn't re-trigger on refresh
      window.history.replaceState({}, document.title, window.location.pathname);
      // Give a more generous delay for the browser to set the httpOnly cookie
      setTimeout(() => {
        checkAuthStatus();
      }, 500); 
    } else {
      checkAuthStatus();
    }
  }, []);

  const checkAuthStatus = async () => {
    try {
      setIsCheckingAuth(true);
      const response = await fetch('/api/auth/youtube/status', { cache: 'no-store' });
      const data = await response.json();
      setAuthStatus(data);
    } catch (error) {
      console.error('Failed to check auth status:', error);
      setAuthStatus({ authenticated: false });
    } finally {
      setIsCheckingAuth(false);
    }
  };

  const handleYouTubeLogin = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    if (authStatus.authenticated) {
      handleYouTubeLogout();
    } else {
      window.location.href = `/api/auth/youtube?action=login&returnTo=${encodeURIComponent(window.location.pathname)}`;
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
        setUploadStatus('ออกจากระบบเรียบร้อย');
        setTimeout(() => setUploadStatus(''), 3000);
      }
    } catch (error) {
      console.error('Logout failed:', error);
      setUploadStatus('เกิดข้อผิดพลาดในการออกจากระบบ');
      setTimeout(() => setUploadStatus(''), 3000);
    }
  };

  const generateAutoDescription = () => {
    const templates = [
      "🎬 วิดีโอใหม่มาแล้ว! อย่าลืมกด Like และ Subscribe นะครับ",
      "✨ เนื้อหาสุดพิเศษที่ไม่ควรพลาด! กดติดตามเพื่อดูคลิปใหม่ๆ",
      "🚀 คลิปเด็ดๆ ที่รอคอยมาแล้ว! ชอบอย่าลืมกด Like และแชร์ต่อ",
      "💫 เรื่องราวน่าสนใจที่จะทำให้คุณติดตาม! Subscribe เลย",
      "🎯 วิดีโอที่จะเปลี่ยนมุมมองของคุณ! กด Like หากชอบนะครับ"
    ];
    
    const randomTemplate = templates[Math.floor(Math.random() * templates.length)];
    const hashtags = "\n\n#เล่าเรื่อง #คลิปไวรัล #viralvideo #shorts #trending #subscribe #like";
    
    setDescription(randomTemplate + hashtags);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, fileType: 'video' | 'thumbnail') => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (fileType === 'video') {
        setVideoFile(file);
        // Auto-generate title from filename
        const filename = file.name.replace(/\.[^/.]+$/, ""); // Remove extension
        setTitle(filename);
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

  const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!authStatus.authenticated) {
      alert('กรุณาเชื่อมต่อกับ YouTube ก่อน');
      return;
    }

    if (!videoFile) {
      alert('กรุณาเลือกไฟล์วิดีโอ');
      return;
    }
    
    if (!title.trim()) {
      alert('กรุณาใส่ชื่อวิดีโอ');
      return;
    }

    if (schedulePost && publishAt) {
      const selectedDate = new Date(publishAt);
      const now = new Date();
      now.setMinutes(now.getMinutes() + 15);
      
      if (selectedDate <= now) {
        alert('เวลาที่ตั้งต้องเป็นอนาคตอย่างน้อย 15 นาที');
        return;
      }
    }

    setIsUploading(true);
    setUploadProgress(0);
    setUploadStatus('เริ่มต้นการอัปโหลดไป YouTube...');

    try {
      const ytFormData = new FormData();
      ytFormData.append('videoFile', videoFile);
      if (thumbnailFile) {
        ytFormData.append('thumbnailFile', thumbnailFile);
      }
      ytFormData.append('description', `${title}\n\n${description}`);
      ytFormData.append('schedulePost', schedulePost.toString());
      if (publishAt) {
        ytFormData.append('publishAt', publishAt);
      }

      setUploadProgress(50);
      setUploadStatus('กำลังอัปโหลดไป YouTube Shorts...');

      const ytResponse = await fetch('/api/upload/youtube', {
        method: 'POST',
        body: ytFormData,
        credentials: 'include',
      });

      const ytResult = await ytResponse.json();

      if (ytResponse.ok) {
        setUploadProgress(100);
        setUploadStatus(`🎉 อัปโหลด YouTube Shorts สำเร็จ! <a href="${ytResult.yt_url}" target="_blank" style="color: #ef4444; text-decoration: underline; font-weight: bold;">ดูวิดีโอ</a>`);
      } else {
        throw new Error(ytResult.error || 'YouTube upload failed');
      }
      
      // Reset form after successful upload
      setTimeout(() => {
        setVideoFile(null);
        setThumbnailFile(null);
        setTitle('');
        setDescription('');
        setSchedulePost(false);
        setPublishAt('');
        setThumbnailPreview(null);
        setIsUploading(false);
        setUploadProgress(0);
        setUploadStatus('');
      }, 8000);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.log('YouTube upload error:', errorMessage);
      setUploadStatus('❌ อัปโหลดล้มเหลว: ' + errorMessage);
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  if (isCheckingAuth) {
    return (
      <main>
        <div className="main-container">
          <div className="glass-container">
            <div className="status-bar status-offline">
              กำลังตรวจสอบสถานะการเชื่อมต่อ...
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main>
      <div className="main-container">
        <div className="logo-section">
          <h1 className="app-title">🎬 YouTube Shorts Tester</h1>
          <p className="app-subtitle">ทดสอบการอัปโหลดไป YouTube Shorts โดยเฉพาะ</p>
          <Link href="/" style={{ color: '#6366f1', textDecoration: 'none', fontSize: '0.9rem' }}>← กลับหน้าหลัก</Link>
        </div>

        <div className="glass-container">
          <div className={`status-bar ${authStatus.authenticated ? 'status-online' : 'status-offline'}`}>
            <span>
              {authStatus.authenticated ? '🟢 YouTube Connected' : '🔴 YouTube Disconnected'}
            </span>
            <a href="#" onClick={handleYouTubeLogin}>
              {authStatus.authenticated ? 'Disconnect' : 'Connect YouTube'}
            </a>
          </div>

          <form className="form-container" onSubmit={handleFormSubmit}>
            <div 
              className={`image-preview-section ${isDragging ? 'dragging' : ''}`}
              onDragOver={(e) => handleDragEvents(e, true)}
              onDragLeave={(e) => handleDragEvents(e, false)}
              onDrop={(e) => handleDrop(e, 'thumbnail')}
            >
              <div id="image-drop-zone" onClick={() => document.getElementById('thumbnail_file')?.click()}>
                {thumbnailPreview ? (
                  <Image src={thumbnailPreview} alt="Thumbnail Preview" fill style={{ objectFit: 'cover' }}/>
                ) : (
                  <>
                    <div style={{ fontSize: '4rem', marginBottom: '1rem', opacity: 0.6 }}>🖼️</div>
                    <p>อัปโหลดภาพปก<br/>(ไม่บังคับ)<br/><small style={{ opacity: 0.7 }}>JPG, PNG รองรับ</small></p>
                  </>
                )}
              </div>
              <input type="file" id="thumbnail_file" accept="image/jpeg,image/png" style={{display: "none"}} onChange={(e) => handleFileChange(e, 'thumbnail')} />
            </div>

            <div className="form-section">
              <div className="form-group">
                <label className="form-label">📹 เลือกไฟล์วิดีโอ</label>
                <div 
                  className={`file-drop-zone ${isDragging ? 'dragging' : ''}`}
                  onDragOver={(e) => handleDragEvents(e, true)}
                  onDragLeave={(e) => handleDragEvents(e, false)}
                  onDrop={(e) => handleDrop(e, 'video')}
                  onClick={() => document.getElementById('video_file')?.click()}
                  style={{ cursor: 'pointer' }}
                >
                  <span>{videoFile ? `✅ ${videoFile.name}` : '📁 คลิกเพื่อเลือกไฟล์วิดีโอ'}</span>
                </div>
                <input type="file" id="video_file" accept="video/mp4,video/quicktime" style={{display: "none"}} onChange={(e) => handleFileChange(e, 'video')} />
              </div>

              <div className="form-group">
                <label className="form-label">📝 ชื่อวิดีโอ</label>
                <input 
                  type="text"
                  className="form-input" 
                  placeholder="ใส่ชื่อวิดีโอที่น่าสนใจ..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  style={{ minHeight: '44px' }}
                />
              </div>

              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <label className="form-label">📄 คำบรรยาย</label>
                  <button 
                    type="button" 
                    onClick={generateAutoDescription}
                    style={{ 
                      background: '#6366f1', 
                      color: 'white', 
                      border: 'none', 
                      padding: '0.5rem 1rem', 
                      borderRadius: '8px',
                      fontSize: '0.8rem',
                      cursor: 'pointer'
                    }}
                  >
                    ✨ สร้างอัตโนมัติ
                  </button>
                </div>
                <textarea 
                  className="form-input" 
                  rows={6} 
                  placeholder="ใส่คำบรรยายวิดีโอ..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                ></textarea>
                <div className="char-counter">{description.length}/5000</div>
              </div>

              <div className="form-group schedule-group">
                <label className="form-label">⏰ ตั้งเวลาโพสต์</label>
                <div className="schedule-toggle-wrapper">
                  <input 
                    type="checkbox" 
                    id="schedule_post" 
                    checked={schedulePost}
                    onChange={(e) => setSchedulePost(e.target.checked)}
                  />
                  <label htmlFor="schedule_post" className="toggle-switch"></label>
                  <span>ตั้งเวลาโพสต์ล่วงหน้า</span>
                </div>
                <input 
                  type="datetime-local" 
                  className="form-input" 
                  disabled={!schedulePost}
                  value={publishAt}
                  onChange={(e) => setPublishAt(e.target.value)}
                  style={{ minHeight: 'auto' }}
                />
              </div>

              <button 
                type="submit" 
                className="btn btn-primary" 
                disabled={isUploading || !authStatus.authenticated}
                style={{ 
                  background: authStatus.authenticated 
                    ? 'linear-gradient(135deg, #ef4444, #dc2626)' 
                    : 'linear-gradient(135deg, #6b7280, #4b5563)',
                  opacity: (!authStatus.authenticated || isUploading) ? 0.6 : 1
                }}
              >
                {isUploading ? (
                  <>
                    <div className="loading"></div>
                    <span>กำลังอัปโหลด...</span>
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                    </svg>
                    <span>🚀 โพสต์ไป YouTube</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {(isUploading || uploadStatus) && (
          <div className="progress-container">
            <div className="progress-bar-wrapper">
              <div className="progress-bar" style={{width: `${uploadProgress}%`}}></div>
            </div>
            <div className="progress-text" dangerouslySetInnerHTML={{ __html: uploadStatus }}></div>
          </div>
        )}
      </div>
    </main>
  );
} 