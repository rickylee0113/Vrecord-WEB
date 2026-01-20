
import React, { useRef, useEffect, useState } from 'react';
import { Upload, Play, Pause, Rewind, FastForward, Clock, FolderOpen, SkipBack, SkipForward, Maximize, Minimize } from 'lucide-react';

interface VideoPlayerProps {
  onTimeUpdate: (time: number) => void;
  videoRef: React.RefObject<HTMLVideoElement>;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ onTimeUpdate, videoRef }) => {
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null); 

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Mouse Wheel Handler for Frame-by-Frame scrubbing
  useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      const handleWheel = (e: WheelEvent) => {
          // Prevent page scrolling when hovering over video
          e.preventDefault();
          
          if (videoRef.current) {
              const vidDuration = videoRef.current.duration;
              // Avoid calculations if duration is not ready (NaN or Infinity)
              if (isNaN(vidDuration) || !isFinite(vidDuration)) return;

              // Auto-pause on scroll
              videoRef.current.pause();
              setIsPlaying(false);

              // Scroll Down (deltaY > 0) -> Forward 0.05s
              // Scroll Up (deltaY < 0) -> Backward 0.05s
              const delta = e.deltaY > 0 ? 0.05 : -0.05;
              const newTime = Math.max(0, Math.min(vidDuration, videoRef.current.currentTime + delta));
              
              videoRef.current.currentTime = newTime;
              setCurrentTime(newTime);
              onTimeUpdate(newTime); // Force update to parent
          }
      };

      // Add event listener with passive: false to allow preventDefault
      container.addEventListener('wheel', handleWheel, { passive: false });

      return () => {
          container.removeEventListener('wheel', handleWheel);
      };
  }, [videoRef, onTimeUpdate, videoSrc]); // Added videoSrc to ensure listener re-attaches when video loads

  const resetPlayerState = () => {
      setCurrentTime(0);
      setDuration(0);
      setIsPlaying(false);
      onTimeUpdate(0);
      if (videoRef.current) {
          try {
              videoRef.current.pause();
              videoRef.current.currentTime = 0;
          } catch (e) {}
      }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (videoSrc) URL.revokeObjectURL(videoSrc);
      const url = URL.createObjectURL(file);
      resetPlayerState();
      setVideoSrc(url);
      event.target.value = '';
    }
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) videoRef.current.pause();
      else videoRef.current.play();
      setIsPlaying(!isPlaying);
    }
  };

  const playVideo = () => {
      if (videoRef.current) {
          videoRef.current.play();
          setIsPlaying(true);
      }
  };

  const pauseVideo = () => {
      if (videoRef.current) {
          videoRef.current.pause();
          setIsPlaying(false);
      }
  };

  const skip = (seconds: number) => {
    if (videoRef.current) {
      // Auto-pause on skip button press
      videoRef.current.pause();
      setIsPlaying(false);

      const vidDuration = videoRef.current.duration || 0;
      const newTime = Math.max(0, Math.min(vidDuration, videoRef.current.currentTime + seconds));
      
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
      onTimeUpdate(newTime);
    }
  };

  const setSpeed = (rate: number) => {
    setPlaybackRate(rate);
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const time = videoRef.current.currentTime;
      setCurrentTime(time);
      onTimeUpdate(time);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    const centiseconds = Math.floor((time % 1) * 100);
    return `${minutes}:${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
  };

  const toggleFullscreen = () => {
      if (!containerRef.current) return;
      if (!document.fullscreenElement) {
          containerRef.current.requestFullscreen().catch(err => console.log("Fullscreen error", err));
      } else {
          document.exitFullscreen().catch(err => console.log("Exit Fullscreen error", err));
      }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;

      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.code === 'KeyX') {
        e.preventDefault();
        skip(-1);
      } else if (e.code === 'KeyC') {
        e.preventDefault();
        skip(1);
      } else if (e.code === 'KeyS') {
        e.preventDefault();
        skip(-10);
      } else if (e.code === 'KeyD') {
        e.preventDefault();
        skip(10);
      } else if (e.code === 'KeyZ' && !e.repeat) {
          e.preventDefault();
          if (containerRef.current) {
              containerRef.current.requestFullscreen().catch(err => console.log("Fullscreen blocked", err));
          }
          playVideo();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
       if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;

       if (e.code === 'KeyZ') {
           e.preventDefault();
           if (document.fullscreenElement) {
               document.exitFullscreen().catch(err => console.log("Exit Fullscreen error", err));
           }
           pauseVideo();
       }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
    };
     // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying]);

  if (!videoSrc) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-slate-900 text-slate-400 p-8 border-r border-slate-700">
        <h2 className="text-xl font-semibold mb-6 text-white">載入影片 (Load Video)</h2>
        <div className="flex-1 w-full max-w-md bg-slate-800 p-8 rounded-xl border border-slate-700 flex flex-col items-center hover:border-blue-500 transition-colors">
            <Upload size={48} className="mb-4 text-blue-500" />
            <h3 className="text-lg font-medium mb-2 text-white">本機影片檔</h3>
            <p className="text-sm text-center mb-6">支援 MP4, WebM 格式</p>
            <label className="cursor-pointer bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-8 rounded-xl transition-colors text-lg shadow-lg">
                瀏覽檔案
                <input type="file" accept="video/mp4,video/webm" onChange={handleFileChange} className="hidden" />
            </label>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-900 border-r border-slate-800">
      <div 
        ref={containerRef} 
        className="flex-1 relative flex items-center justify-center bg-black overflow-hidden group"
      >
        <video
            key={videoSrc}
            ref={videoRef}
            src={videoSrc}
            className="max-w-full max-h-full"
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onEnded={() => setIsPlaying(false)}
            onClick={togglePlay}
        />

        {/* Fullscreen Progress Bar Overlay */}
        {isFullscreen && (
            <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 via-black/40 to-transparent z-50 flex flex-col justify-end">
               <div className="flex items-center gap-4 text-white drop-shadow-md">
                  <span className="text-lg font-mono font-bold w-24">{formatTime(currentTime)}</span>
                  <input 
                      type="range" 
                      min="0" 
                      max={duration || 100} 
                      step="0.01" 
                      value={currentTime}
                      onChange={(e) => {
                          const val = Number(e.target.value);
                          if (videoRef.current) videoRef.current.currentTime = val;
                          setCurrentTime(val);
                      }}
                      className="flex-1 h-4 bg-white/30 rounded-full appearance-none cursor-pointer accent-blue-500 hover:bg-white/50 transition-all"
                  />
                  <span className="text-lg font-mono font-bold w-24 text-right">{formatTime(duration)}</span>
               </div>
            </div>
        )}
      </div>

      <div className="bg-slate-800 p-4 border-t border-slate-700">
        <div className="flex items-center gap-3 text-xs text-slate-400 mb-3">
            <span className="font-mono w-16 text-right">{formatTime(currentTime)}</span>
            <input 
                type="range" 
                min="0" 
                max={duration || 100} 
                step="0.01"
                value={currentTime}
                onChange={(e) => {
                    const val = Number(e.target.value);
                    if (videoRef.current) videoRef.current.currentTime = val;
                    setCurrentTime(val);
                }}
                className="flex-1 h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
            <span className="font-mono w-16">{formatTime(duration)}</span>
        </div>

        <div className="flex items-center justify-between flex-wrap gap-y-2">
            <div className="flex items-center gap-2 sm:gap-3">
                {/* Back 10s (S) */}
                <button 
                    onClick={() => skip(-10)} 
                    className="group relative p-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg flex flex-col items-center gap-0.5 border border-slate-600 transition-all active:scale-95" 
                    title="快退 10 秒 (S)"
                >
                    <div className="absolute -top-3 -right-2 bg-slate-500 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded shadow-sm z-10 border border-slate-400">S</div>
                    <SkipBack size={18} />
                    <span className="text-[9px] font-bold">-10s</span>
                </button>

                {/* Rewind (X) - 1s */}
                <button 
                    onClick={() => skip(-1)} 
                    className="group relative p-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg flex flex-col items-center gap-0.5 border border-slate-600 transition-all active:scale-95" 
                    title="快退 1 秒 (X)"
                >
                    <div className="absolute -top-3 -right-2 bg-yellow-400 text-black text-[10px] font-black w-5 h-5 flex items-center justify-center rounded shadow-sm z-10 border border-yellow-500">X</div>
                    <Rewind size={18} />
                    <span className="text-[9px] font-bold">-1s</span>
                </button>

                <button 
                    onClick={togglePlay}
                    className="w-12 h-12 flex items-center justify-center bg-blue-600 hover:bg-blue-500 text-white rounded-full transition-colors shadow-lg mx-1"
                    title="播放/暫停 (Space) - 按住 Z 全螢幕"
                >
                    {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" className="ml-1" />}
                </button>

                {/* Forward (C) - 1s */}
                <button 
                    onClick={() => skip(1)} 
                    className="group relative p-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg flex flex-col items-center gap-0.5 border border-slate-600 transition-all active:scale-95" 
                    title="快轉 1 秒 (C)"
                >
                    <div className="absolute -top-3 -right-2 bg-yellow-400 text-black text-[10px] font-black w-5 h-5 flex items-center justify-center rounded shadow-sm z-10 border border-yellow-500">C</div>
                    <FastForward size={18} />
                    <span className="text-[9px] font-bold">+1s</span>
                </button>

                {/* Forward 10s (D) */}
                <button 
                    onClick={() => skip(10)} 
                    className="group relative p-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg flex flex-col items-center gap-0.5 border border-slate-600 transition-all active:scale-95" 
                    title="快轉 10 秒 (D)"
                >
                    <div className="absolute -top-3 -right-2 bg-slate-500 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded shadow-sm z-10 border border-slate-400">D</div>
                    <SkipForward size={18} />
                    <span className="text-[9px] font-bold">+10s</span>
                </button>
            </div>

            <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 bg-slate-700 rounded-lg p-1">
                    <span className="text-[10px] text-slate-400 pl-1 flex items-center gap-1">
                        <Clock size={10} />
                    </span>
                    {[0.5, 0.75, 1.0].map((rate) => (
                        <button
                            key={rate}
                            onClick={() => setSpeed(rate)}
                            className={`text-[10px] px-2 py-1 rounded ${playbackRate === rate ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-600'}`}
                        >
                            {rate}x
                        </button>
                    ))}
                </div>
                
                <div className="w-px h-8 bg-slate-700 mx-1"></div>

                {/* Fullscreen Button with Hint */}
                <button 
                    onClick={toggleFullscreen}
                    className="flex flex-col items-center justify-center p-2 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors group"
                    title="按住 Z 全螢幕 (Hold Z)"
                >
                    {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
                    <span className="text-[9px] group-hover:text-blue-300 transition-colors">全螢幕(Z)</span>
                </button>

                <button 
                    onClick={() => {
                        setVideoSrc(null);
                        resetPlayerState();
                    }} 
                    className="flex flex-col items-center justify-center p-2 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                    title="開啟新影片"
                >
                    <FolderOpen size={18} />
                    <span className="text-[9px]">開啟</span>
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default VideoPlayer;
