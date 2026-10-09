'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { classifyCameraError, type CameraErrorKind } from './camera-errors';

export type CameraStatus = 'starting' | 'ready' | 'error';

// A 4:3 frame is what a phone front camera and a laptop webcam both deliver natively. The saved
// photo is a 3:4 crop of it (lib/image-compress), so 1280x960 leaves a 720x960 portrait, sharper
// than the 1024 px long edge needs. These are `ideal` values (never `exact`): the browser picks the
// nearest mode instead of failing on a camera that cannot do it.
const IDEAL_FRAME = { width: { ideal: 1280 }, height: { ideal: 960 } } as const;

/** How long we wait for the permission prompt before saying so (the prompt can be ignored forever). */
const SLOW_PERMISSION_MS = 6000;

function frontConstraints(deviceId?: string): MediaStreamConstraints {
  return {
    audio: false,
    video: deviceId ? { deviceId: { exact: deviceId }, ...IDEAL_FRAME } : { facingMode: 'user', ...IDEAL_FRAME },
  };
}

const LOOSE_CONSTRAINTS: MediaStreamConstraints = { audio: false, video: true };

async function openStream(deviceId?: string): Promise<MediaStream> {
  const media = navigator.mediaDevices;
  try {
    return await media.getUserMedia(frontConstraints(deviceId));
  } catch (error) {
    const kind = classifyCameraError(error);
    // A refusal is final; anything else may just be our constraints (an old webcam, a device that
    // vanished): try once with no constraints at all before giving up.
    if (kind === 'denied') throw error;
    return await media.getUserMedia(LOOSE_CONSTRAINTS);
  }
}

export interface UseCameraResult {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  /** Callback ref for the <video>: a stream that arrives before the element mounts (or after it
   * remounts, e.g. when the screen moves into the full-screen sheet) is attached as soon as it does. */
  setVideoEl: (el: HTMLVideoElement | null) => void;
  status: CameraStatus;
  errorKind: CameraErrorKind | null;
  /** Increments for every stream that opens (first start, retry, camera switch). A frame is "ready"
   * once the <video> reports `playing` for the current generation. */
  streamGen: number;
  /** The permission prompt has been open for a while. */
  slowPermission: boolean;
  /** The preview is mirrored (front camera, the default on a laptop). The saved photo never is. */
  mirrored: boolean;
  /** More than one camera is available. */
  canSwitch: boolean;
  switchCamera: () => void;
  torchSupported: boolean;
  torchOn: boolean;
  toggleTorch: () => void;
  /** Re-opens the camera after an error ("Coba Lagi"). */
  retry: () => void;
}

/**
 * Owns the camera stream for the selfie screen: front camera first with graceful fallbacks, a
 * switch between cameras when the device has several, an optional torch, recovery when the stream
 * ends (unplugged, revoked, a phone that slept) and a complete cleanup on unmount (every track is
 * stopped, so the camera light goes off the moment the person leaves the screen). Errors are
 * classified (camera-errors.ts) so the UI can say what to do.
 */
export function useCamera({ enabled = true }: { enabled?: boolean } = {}): UseCameraResult {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  // Bumped on every (re)start and on unmount: an async step that finds a newer number is stale.
  const attemptRef = useRef(0);
  const deviceIdRef = useRef<string | undefined>(undefined);
  const devicesRef = useRef<MediaDeviceInfo[]>([]);

  const [status, setStatus] = useState<CameraStatus>('starting');
  const [errorKind, setErrorKind] = useState<CameraErrorKind | null>(null);
  const [slowPermission, setSlowPermission] = useState(false);
  const [streamGen, setStreamGen] = useState(0);
  const [mirrored, setMirrored] = useState(true);
  const [deviceCount, setDeviceCount] = useState(0);
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  const setVideoEl = useCallback((el: HTMLVideoElement | null) => {
    videoRef.current = el;
    if (el && streamRef.current && el.srcObject !== streamRef.current) {
      el.srcObject = streamRef.current;
      el.play().catch(() => {});
    }
  }, []);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const refreshDevices = useCallback(async () => {
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      devicesRef.current = all.filter((d) => d.kind === 'videoinput');
      setDeviceCount(devicesRef.current.length);
    } catch {
      devicesRef.current = [];
      setDeviceCount(0);
    }
  }, []);

  const start = useCallback(
    async (deviceId?: string) => {
      const attempt = ++attemptRef.current;
      const stale = () => attempt !== attemptRef.current;

      stopStream();
      setStatus('starting');
      setErrorKind(null);
      setTorchOn(false);
      setTorchSupported(false);

      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        setErrorKind(typeof window !== 'undefined' && window.isSecureContext === false ? 'insecure' : 'unsupported');
        setStatus('error');
        return;
      }

      const slowTimer = window.setTimeout(() => {
        if (!stale()) setSlowPermission(true);
      }, SLOW_PERMISSION_MS);
      setSlowPermission(false);

      try {
        const stream = await openStream(deviceId);
        window.clearTimeout(slowTimer);
        if (stale()) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        setSlowPermission(false);

        const track = stream.getVideoTracks()[0];
        const settings = track?.getSettings?.() ?? {};
        const label = track?.label ?? '';
        // Only a rear camera is un-mirrored. Webcams report no facingMode at all and are mirrored.
        setMirrored(settings.facingMode !== 'environment' && !/back|rear|environment|belakang/i.test(label));
        const capabilities = (track?.getCapabilities?.() ?? {}) as MediaTrackCapabilities & { torch?: boolean };
        setTorchSupported(Boolean(capabilities.torch));

        const onEnded = () => {
          if (stale()) return;
          setErrorKind('lost');
          setStatus('error');
        };
        track?.addEventListener('ended', onEnded);

        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          // autoPlay normally starts it; play() is explicit for browsers that need the nudge, and
          // its rejection (an interrupted load) is harmless.
          video.play().catch(() => {});
        }
        setStreamGen((n) => n + 1);
        setStatus('ready');
        deviceIdRef.current = (settings.deviceId as string | undefined) ?? deviceId;
        void refreshDevices();
      } catch (error) {
        window.clearTimeout(slowTimer);
        if (stale()) return;
        setErrorKind(classifyCameraError(error));
        setStatus('error');
        setSlowPermission(false);
      }
    },
    [refreshDevices, stopStream],
  );

  useEffect(() => {
    if (!enabled) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- opening the camera is the effect: start() sets the "starting" status before it awaits
    void start();
    return () => {
      attemptRef.current += 1;
      stopStream();
    };
  }, [enabled, start, stopStream]);

  // A phone that slept or switched apps ends the stream; coming back should just work.
  useEffect(() => {
    if (!enabled) return;
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      const track = streamRef.current?.getVideoTracks()[0];
      if (streamRef.current && track && track.readyState === 'ended') void start(deviceIdRef.current);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [enabled, start]);

  // A camera plugged in or out while the screen is open.
  useEffect(() => {
    if (!enabled || !navigator.mediaDevices?.addEventListener) return;
    const onChange = () => void refreshDevices();
    navigator.mediaDevices.addEventListener('devicechange', onChange);
    return () => navigator.mediaDevices.removeEventListener('devicechange', onChange);
  }, [enabled, refreshDevices]);

  const switchCamera = useCallback(() => {
    const list = devicesRef.current;
    if (list.length < 2) return;
    const index = list.findIndex((d) => d.deviceId === deviceIdRef.current);
    const next = list[(index + 1) % list.length];
    if (!next) return;
    // MDN: release the current camera before asking for another (start() stops the stream first).
    void start(next.deviceId);
  }, [start]);

  const toggleTorch = useCallback(() => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const next = !torchOn;
    track
      .applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] })
      .then(() => setTorchOn(next))
      .catch(() => setTorchSupported(false));
  }, [torchOn]);

  const retry = useCallback(() => void start(deviceIdRef.current), [start]);

  return {
    videoRef,
    setVideoEl,
    status,
    errorKind,
    streamGen,
    slowPermission,
    mirrored,
    canSwitch: deviceCount > 1,
    switchCamera,
    torchSupported,
    torchOn,
    toggleTorch,
    retry,
  };
}
