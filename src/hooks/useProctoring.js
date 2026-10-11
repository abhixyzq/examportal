import { useEffect, useRef, useState, useCallback } from 'react';

// Synthesize an alert beep using Web Audio API
function playWarningBeep() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(480, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(240, ctx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch {
    // Audio context may fail if user hasn't interacted yet
  }
}

export function useProctoring({
  enabled = true,
  maxViolations = 3,
  onAutoSubmit,
  onViolation,
}) {
  const [violations, setViolations] = useState([]);
  const [violationCount, setViolationCount] = useState(0);
  const [showWarning, setShowWarning] = useState(false);
  const [warningType, setWarningType] = useState('');
  const [isFullscreenActive, setIsFullscreenActive] = useState(false);
  const [showReloadWarning, setShowReloadWarning] = useState(false);

  // References for reliable state access inside listeners
  const countRef = useRef(0);
  const lastViolationTime = useRef(0);
  const isStartedRef = useRef(false);
  const callbacksRef = useRef({ onAutoSubmit, onViolation });

  useEffect(() => {
    callbacksRef.current = { onAutoSubmit, onViolation };
  }, [onAutoSubmit, onViolation]);

  useEffect(() => {
    isStartedRef.current = enabled;
  }, [enabled]);

  const addViolation = useCallback((type) => {
    if (!enabled) return;

    const now = Date.now();
    // Throttle duplicate violations within 1.2 seconds (e.g. blur + tab_switch together)
    if (now - lastViolationTime.current < 1200) {
      return;
    }
    lastViolationTime.current = now;

    playWarningBeep();

    countRef.current += 1;
    const currentCount = countRef.current;
    setViolationCount(currentCount);

    const v = {
      type,
      time: new Date().toISOString(),
      count: currentCount,
    };

    setViolations(prev => [...prev, v]);
    setWarningType(type);
    setShowWarning(true);

    if (callbacksRef.current.onViolation) {
      callbacksRef.current.onViolation(v);
    }

    if (currentCount >= maxViolations) {
      if (callbacksRef.current.onAutoSubmit) {
        callbacksRef.current.onAutoSubmit('max_violations');
      }
    }
  }, [enabled, maxViolations]);

  // Request Fullscreen on user click
  const enterFullscreen = useCallback(async () => {
    try {
      const el = document.documentElement;
      if (el.requestFullscreen) {
        await el.requestFullscreen();
      } else if (el.webkitRequestFullscreen) {
        await el.webkitRequestFullscreen();
      }
      setIsFullscreenActive(true);
      isStartedRef.current = true;
      return true;
    } catch (err) {
      console.warn('Fullscreen request rejected:', err);
      setIsFullscreenActive(true);
      isStartedRef.current = true;
      return false;
    }
  }, []);

  // 1. Tab switch (visibilitychange)
  useEffect(() => {
    if (!enabled) return;
    const handleVisibility = () => {
      if (document.hidden) {
        addViolation('tab_switch');
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [addViolation, enabled]);

  // 2. Window blur (Alt+Tab, clicking outside, switching app)
  useEffect(() => {
    if (!enabled) return;
    const handleBlur = () => {
      addViolation('window_blur');
    };
    window.addEventListener('blur', handleBlur);
    return () => window.removeEventListener('blur', handleBlur);
  }, [addViolation, enabled]);

  // 3. Right Click: Block context menu completely, but DO NOT count as violation
  useEffect(() => {
    if (!enabled) return;
    const block = (e) => {
      e.preventDefault();
    };
    document.addEventListener('contextmenu', block);
    return () => document.removeEventListener('contextmenu', block);
  }, [enabled]);

  // 4. Refresh & Page Unload Warning (Browser level dialog)
  useEffect(() => {
    if (!enabled) return;
    const handleBeforeUnload = (e) => {
      e.preventDefault();
      // Standard browser confirmation dialog for leaving/reloading
      e.returnValue = 'Are you sure you want to reload or leave the exam? Your unsaved progress will be lost.';
      return e.returnValue;
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [enabled]);

  // 5. Copy / Paste / Cut
  useEffect(() => {
    if (!enabled) return;
    const handleCopyPaste = (e) => {
      e.preventDefault();
      addViolation('copy_paste');
    };
    document.addEventListener('copy', handleCopyPaste);
    document.addEventListener('paste', handleCopyPaste);
    document.addEventListener('cut', handleCopyPaste);
    return () => {
      document.removeEventListener('copy', handleCopyPaste);
      document.removeEventListener('paste', handleCopyPaste);
      document.removeEventListener('cut', handleCopyPaste);
    };
  }, [addViolation, enabled]);

  // 6. Block Keyboard Shortcuts, Refresh keys, & Screenshots
  useEffect(() => {
    if (!enabled) return;
    const handleKeyDown = (e) => {
      const key = (e.key || '').toLowerCase();
      const code = e.keyCode || e.which;

      // Reload attempt (F5, Ctrl+R, Cmd+R, Ctrl+Shift+R) -> Warn student
      if (e.key === 'F5' || ((e.ctrlKey || e.metaKey) && key === 'r')) {
        e.preventDefault();
        setShowReloadWarning(true);
        return;
      }

      // PrintScreen / Screenshot attempt
      if (e.key === 'PrintScreen' || code === 44) {
        e.preventDefault();
        addViolation('screenshot_attempt');
        return;
      }

      // DevTools (F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C)
      if (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && ['i', 'j', 'c'].includes(key)) ||
        (e.metaKey && e.altKey && ['i', 'j'].includes(key))
      ) {
        e.preventDefault();
        addViolation('devtools_open');
        return;
      }

      // Copy / Cut / Paste / Select All shortcuts
      if ((e.ctrlKey || e.metaKey) && ['c', 'v', 'x', 'a'].includes(key)) {
        e.preventDefault();
        addViolation('copy_paste');
        return;
      }

      // Restricted shortcuts (Ctrl+U view source, Ctrl+S save, Ctrl+P print)
      if ((e.ctrlKey || e.metaKey) && ['u', 's', 'p'].includes(key)) {
        e.preventDefault();
        addViolation('unauthorized_shortcut');
        return;
      }

      // Alt+Tab simulation attempt
      if (e.altKey && (key === 'tab' || key === 'arrowleft' || key === 'arrowright')) {
        e.preventDefault();
        addViolation('tab_switch');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [addViolation, enabled]);

  // 7. Fullscreen exit detection
  useEffect(() => {
    if (!enabled) return;
    const handleFsChange = () => {
      const inFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
      if (!inFs && isStartedRef.current) {
        addViolation('fullscreen_exit');
      }
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    document.addEventListener('webkitfullscreenchange', handleFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      document.removeEventListener('webkitfullscreenchange', handleFsChange);
    };
  }, [addViolation, enabled]);

  const dismissWarning = () => setShowWarning(false);
  const dismissReloadWarning = () => setShowReloadWarning(false);

  return {
    violations,
    violationCount,
    showWarning,
    warningType,
    showReloadWarning,
    dismissReloadWarning,
    isFullscreenActive,
    dismissWarning,
    enterFullscreen,
    maxViolations,
    remaining: Math.max(0, maxViolations - violationCount),
  };
}
