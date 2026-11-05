import { useState, useEffect, useRef, useCallback } from 'react';

export const useYoutubePlayer = ({
  containerId,
  videoId,
  playbackState,
  currentTime,
  syncTimestamp,
  seekCommand,
  canControl,
  onUserPlay,
  onUserPause,
}) => {
  const [player, setPlayer] = useState(null);
  const [isReady, setIsReady] = useState(false);
  const [duration, setDuration] = useState(0);
  const [localCurrentTime, setLocalCurrentTime] = useState(0);
  const [volume, setVolume] = useState(80);
  const [isMuted, setIsMuted] = useState(false);
  const lastAppliedSeekIdRef = useRef(null);
  const pendingSeekRef = useRef(null);
  const seekRetryTimersRef = useRef(new Set());

  const playerRef = useRef(null);
  const currentVideoIdRef = useRef(videoId || null);
  const playbackStateRef = useRef(playbackState);
  const programmaticUntilRef = useRef(0);
  const hasLoadedVideoRef = useRef(false);
  const canControlRef = useRef(canControl);
  const callbacksRef = useRef({ onUserPlay, onUserPause });

  useEffect(() => {
    canControlRef.current = canControl;
    callbacksRef.current = { onUserPlay, onUserPause };
  }, [canControl, onUserPlay, onUserPause]);

  useEffect(() => {
    playbackStateRef.current = playbackState;
  }, [playbackState]);

  const markProgrammatic = useCallback(() => {
    programmaticUntilRef.current = Date.now() + 1200;
  }, []);

  const safePlay = useCallback((targetPlayer) => {
    const p = targetPlayer || playerRef.current;
    if (!p || typeof p.playVideo !== 'function' || !videoId) return;
    try {
      markProgrammatic();
      p.playVideo();
    } catch (err) {
      console.warn('[YouTube] playVideo failed:', err);
    }
  }, [markProgrammatic, videoId]);

  // Load YouTube IFrame API once.
  useEffect(() => {
    if (window.YT?.Player) return;
    if (!document.querySelector('script[data-watchparty-youtube-api]')) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      tag.async = true;
      tag.dataset.watchpartyYoutubeApi = 'true';
      document.head.appendChild(tag);
    }
  }, []);

  // Create one player instance. An empty room intentionally starts with no video.
  useEffect(() => {
    let cancelled = false;
    let ytPlayer = null;

    const createPlayer = () => {
      if (cancelled || !window.YT?.Player || playerRef.current) return;
      ytPlayer = new window.YT.Player(containerId, {
        host: 'https://www.youtube-nocookie.com',
        ...(videoId ? { videoId } : {}),
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          fs: 0,
          modestbranding: 1,
          rel: 0,
          origin: window.location.origin,
          widget_referrer: window.location.origin,
          enablejsapi: 1,
          playsinline: 1,
          iv_load_policy: 3,
        },
        events: {
          onReady: (event) => {
            if (cancelled) return;
            const p = event.target;
            playerRef.current = p;
            setPlayer(p);
            setIsReady(true);
            setDuration(p.getDuration?.() || 0);
            p.setVolume?.(80);
            currentVideoIdRef.current = videoId || null;
            hasLoadedVideoRef.current = Boolean(videoId);
            try {
              const iframe = p.getIframe?.();
              if (iframe) {
                iframe.setAttribute('title', 'Synchronized YouTube video');
                iframe.setAttribute('tabindex', '-1');
                iframe.setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture');
                iframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
                iframe.style.width = '100%';
                iframe.style.height = '100%';
                iframe.style.border = '0';
                // All interaction is through the app's synchronized controls.
                iframe.style.pointerEvents = 'none';
              }
            } catch (err) {
              console.warn('[YouTube] iframe setup warning:', err);
            }
            if (videoId) {
              if (currentTime > 0) {
                markProgrammatic();
                p.seekTo(currentTime, true);
              }
              if (playbackState === 'playing') safePlay(p);
            }
          },
          onStateChange: (event) => {
            if (!event.target) return;
            const state = event.data;
            const now = Date.now();
            if (now < programmaticUntilRef.current) return;

            const time = event.target.getCurrentTime?.() || 0;
            if (!canControlRef.current) {
              // Participants cannot alter the room player. Restore the server's state.
              markProgrammatic();
              if (playbackStateRef.current === 'playing') event.target.playVideo?.();
              else event.target.pauseVideo?.();
              return;
            }

            if (state === window.YT.PlayerState.PLAYING) callbacksRef.current.onUserPlay?.(time);
            if (state === window.YT.PlayerState.PAUSED) callbacksRef.current.onUserPause?.(time);
          },
          onAutoplayBlocked: (event) => {
            // Browsers commonly block unmuted autoplay after a page refresh.
            // Retry muted so the participant still follows the Host's timeline;
            // the user can enable audio with the in-app unmute control.
            const blockedPlayer = event?.target || playerRef.current;
            if (!blockedPlayer || playbackStateRef.current !== 'playing') return;
            try {
              markProgrammatic();
              blockedPlayer.mute?.();
              setIsMuted(true);
              blockedPlayer.playVideo?.();
            } catch (retryError) {
              console.warn('[YouTube] Muted autoplay retry failed:', retryError);
            }
          },
          onError: (event) => console.warn('[YouTube] Player error code:', event.data),
        },
      });
    };

    if (window.YT?.Player) {
      createPlayer();
    } else {
      const previous = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (typeof previous === 'function') previous();
        createPlayer();
      };
    }

    return () => {
      cancelled = true;
      if (ytPlayer?.destroy) {
        try { ytPlayer.destroy(); } catch (err) {}
      } else if (playerRef.current?.destroy) {
        try { playerRef.current.destroy(); } catch (err) {}
      }
      playerRef.current = null;
      hasLoadedVideoRef.current = false;
      setPlayer(null);
      setIsReady(false);
    };
    // Player instance is deliberately created once per container.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerId]);

  // A video is loaded only after Host/Moderator selects one.
  useEffect(() => {
    const p = playerRef.current;
    if (!isReady || !p) return;

    if (!videoId) {
      currentVideoIdRef.current = null;
      hasLoadedVideoRef.current = false;
      setDuration(0);
      setLocalCurrentTime(0);
      try { markProgrammatic(); p.stopVideo?.(); } catch (err) {}
      return;
    }

    if (currentVideoIdRef.current !== videoId) {
      currentVideoIdRef.current = videoId;
      hasLoadedVideoRef.current = true;
      setLocalCurrentTime(0);
      markProgrammatic();
      try {
        p.loadVideoById({ videoId, startSeconds: Math.max(0, currentTime || 0) });
        if (playbackState !== 'playing') {
          // loadVideoById starts playback; pause when the authoritative room state is paused.
          window.setTimeout(() => {
            if (playerRef.current) {
              markProgrammatic();
              playerRef.current.pauseVideo?.();
            }
          }, 250);
        }
      } catch (err) {
        console.error('[YouTube] loadVideoById error:', err);
      }
    }
  }, [videoId, isReady, currentTime, playbackState, markProgrammatic]);

  // An approved Participant seek is an explicit room command. YouTube can
  // ignore seekTo briefly while a video is still loading/buffering, so retry
  // until the iframe reports the requested position instead of assuming that
  // the first API call succeeded.
  useEffect(() => {
    const p = playerRef.current;
    if (!isReady || !p || !videoId || !seekCommand) return undefined;

    const seekId = seekCommand.seekId || String(seekCommand.issuedAt || Date.now());
    if (lastAppliedSeekIdRef.current === seekId) return undefined;

    const target = Number(seekCommand.currentTime);
    if (!Number.isFinite(target) || target < 0) return undefined;

    lastAppliedSeekIdRef.current = seekId;
    pendingSeekRef.current = { seekId, target, expiresAt: Date.now() + 6000 };
    setLocalCurrentTime(target);

    let cancelled = false;
    let attempts = 0;
    const applyApprovedSeek = () => {
      if (cancelled || playerRef.current !== p) return;

      try {
        const activeVideoId = p.getVideoData?.()?.video_id;
        // If the iframe is in the middle of switching videos, wait for the
        // requested room video before applying the seek target.
        if (activeVideoId && activeVideoId !== videoId && attempts < 8) {
          attempts += 1;
          const waitTimer = window.setTimeout(() => {
            seekRetryTimersRef.current.delete(waitTimer);
            applyApprovedSeek();
          }, 250);
          seekRetryTimersRef.current.add(waitTimer);
          return;
        }

        markProgrammatic();
        p.seekTo(target, true);

        if (seekCommand.playbackState === 'playing') {
          const state = p.getPlayerState?.();
          if (state !== 1 && state !== 3) safePlay(p);
        } else if (seekCommand.playbackState === 'paused') {
          const state = p.getPlayerState?.();
          if (state === 1 || state === 3) p.pauseVideo?.();
        }
      } catch (err) {
        console.warn('[YouTube] Approved seek attempt failed:', err);
      }

      const verifyTimer = window.setTimeout(() => {
        seekRetryTimersRef.current.delete(verifyTimer);
        if (cancelled || playerRef.current !== p) return;

        let actualTime = 0;
        try { actualTime = Number(p.getCurrentTime?.() || 0); } catch (err) {}

        if (Math.abs(actualTime - target) > 1.5 && attempts < 5) {
          attempts += 1;
          applyApprovedSeek();
          return;
        }

        if (Math.abs(actualTime - target) <= 1.5) {
          setLocalCurrentTime(actualTime);
        } else {
          console.warn(`[YouTube] Could not confirm approved seek to ${target}s; iframe is at ${actualTime}s.`);
          setLocalCurrentTime(actualTime);
        }
        if (pendingSeekRef.current?.seekId === seekId) pendingSeekRef.current = null;
      }, attempts === 0 ? 450 : 650);
      seekRetryTimersRef.current.add(verifyTimer);
    };

    applyApprovedSeek();

    return () => {
      cancelled = true;
      for (const timer of seekRetryTimersRef.current) {
        window.clearTimeout(timer);
      }
      seekRetryTimersRef.current.clear();
      if (pendingSeekRef.current?.seekId === seekId) pendingSeekRef.current = null;
    };
  }, [seekCommand, isReady, videoId, markProgrammatic, safePlay]);

  // Keep displayed time and duration fresh.
  useEffect(() => {
    if (!isReady || !playerRef.current || !videoId) return undefined;
    const timer = window.setInterval(() => {
      try {
        const p = playerRef.current;
        if (!p) return;
        const t = p.getCurrentTime?.() || 0;
        const d = p.getDuration?.() || 0;
        const pendingSeek = pendingSeekRef.current;
        if (pendingSeek && Date.now() < pendingSeek.expiresAt && Math.abs(t - pendingSeek.target) > 1.5) {
          // Keep the approved target visible while the iframe completes its seek.
          return;
        }
        if (pendingSeek && Math.abs(t - pendingSeek.target) <= 1.5) {
          pendingSeekRef.current = null;
        }
        setLocalCurrentTime(t);
        if (d > 0) setDuration((old) => old === d ? old : d);
      } catch (err) {}
    }, 250);
    return () => window.clearInterval(timer);
  }, [isReady, videoId]);

  // Apply authoritative room state and correct drift without creating socket loops.
  useEffect(() => {
    const p = playerRef.current;
    if (!isReady || !p || !videoId) return;
    try {
      const playerTime = p.getCurrentTime?.() || 0;
      const state = p.getPlayerState?.();
      const pendingSeek = pendingSeekRef.current;
      const desiredTime = pendingSeek && Date.now() < pendingSeek.expiresAt
        ? pendingSeek.target
        : Math.max(0, currentTime || 0);
      if (Math.abs(playerTime - desiredTime) > 1.25) {
        markProgrammatic();
        p.seekTo(desiredTime, true);
      }
      if (playbackState === 'playing') {
        if (state !== 1 && state !== 3) safePlay(p);
      } else if (playbackState === 'paused' && (state === 1 || state === 3)) {
        markProgrammatic();
        p.pauseVideo();
      }
    } catch (err) {
      console.error('[YouTube] Sync state error:', err);
    }
  }, [playbackState, currentTime, syncTimestamp, isReady, videoId, safePlay, markProgrammatic]);

  const seekTo = useCallback((targetSeconds) => {
    const valid = Math.max(0, Number.isFinite(Number(targetSeconds)) ? Number(targetSeconds) : 0);
    setLocalCurrentTime(valid);
    if (playerRef.current?.seekTo && videoId) {
      markProgrammatic();
      playerRef.current.seekTo(valid, true);
    }
  }, [videoId, markProgrammatic]);

  const handleVolumeChange = useCallback((newVol) => {
    const vol = Math.max(0, Math.min(100, Number(newVol) || 0));
    setVolume(vol);
    if (playerRef.current?.setVolume) playerRef.current.setVolume(vol);
    if (vol > 0 && isMuted) {
      playerRef.current?.unMute?.();
      setIsMuted(false);
    }
  }, [isMuted]);

  const handleToggleMute = useCallback(() => {
    if (!playerRef.current) return;
    if (isMuted) {
      playerRef.current.unMute?.();
      setIsMuted(false);
    } else {
      playerRef.current.mute?.();
      setIsMuted(true);
    }
  }, [isMuted]);

  return {
    player,
    isReady,
    duration,
    localCurrentTime,
    volume,
    isMuted,
    handleVolumeChange,
    handleToggleMute,
    seekTo,
  };
};

export default useYoutubePlayer;
