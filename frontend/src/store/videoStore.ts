import { create } from 'zustand';

interface Keyframe {
  frame: number;
  points: number[];
  outside: boolean;
  occluded: boolean;
}

interface Track {
  trackId: number;
  labelId: number;
  shapeType: 'rectangle' | 'polygon' | 'polyline' | 'points';
  keyframes: Keyframe[];
}

interface VideoState {
  videoId: number | null;
  frameUrls: string[];
  frameW: number;
  frameH: number;
  currentFrame: number;
  playing: boolean;
  playbackRate: number;
  tracks: Track[];

  setVideo: (v: { id: number; frameUrls: string[]; w: number; h: number }) => void;
  setFrame: (f: number) => void;
  stepFrame: (delta: number) => void;
  togglePlay: () => void;
  setPlaybackRate: (r: number) => void;

  upsertTrack: (t: Track) => void;
  addKeyframe: (trackId: number, kf: Keyframe) => void;
  removeTrack: (trackId: number) => void;
  clear: () => void;
}

export const useVideoStore = create<VideoState>((set, get) => ({
  videoId: null,
  frameUrls: [],
  frameW: 0,
  frameH: 0,
  currentFrame: 0,
  playing: false,
  playbackRate: 1,
  tracks: [],

  setVideo: ({ id, frameUrls, w, h }) =>
    set({ videoId: id, frameUrls, frameW: w, frameH: h, currentFrame: 0 }),

  setFrame: (f) =>
    set((s) => ({ currentFrame: Math.max(0, Math.min(s.frameUrls.length - 1, f)) })),

  stepFrame: (delta) => get().setFrame(get().currentFrame + delta),

  togglePlay: () => set((s) => ({ playing: !s.playing })),
  setPlaybackRate: (r) => set({ playbackRate: r }),

  upsertTrack: (t) =>
    set((s) => {
      const idx = s.tracks.findIndex((x) => x.trackId === t.trackId);
      if (idx >= 0) {
        const next = [...s.tracks];
        next[idx] = t;
        return { tracks: next };
      }
      return { tracks: [...s.tracks, t] };
    }),

  addKeyframe: (trackId, kf) =>
    set((s) => ({
      tracks: s.tracks.map((t) => {
        if (t.trackId !== trackId) return t;
        const keyframes = [...t.keyframes.filter((k) => k.frame !== kf.frame), kf]
          .sort((a, b) => a.frame - b.frame);
        return { ...t, keyframes };
      }),
    })),

  removeTrack: (trackId) =>
    set((s) => ({ tracks: s.tracks.filter((t) => t.trackId !== trackId) })),

  clear: () =>
    set({
      videoId: null, frameUrls: [], frameW: 0, frameH: 0,
      currentFrame: 0, playing: false, tracks: [],
    }),
}));