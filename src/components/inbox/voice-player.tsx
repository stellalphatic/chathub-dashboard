"use client";

import { Pause, Play } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * WhatsApp-style voice note player.
 *
 * Visual: a row of bar-shaped "waveform" segments, a play/pause button,
 * an elapsed-time label, and a progress fill that sweeps across the bars
 * as playback advances. We don't decode the actual audio waveform (that
 * would require Web Audio + a costly fetch); instead the bars are a
 * deterministic pseudo-random pattern derived from the URL so each
 * message has its own unique-looking shape but stays stable on re-render.
 */
export function VoicePlayer({
  src,
  outbound,
}: {
  src: string;
  outbound: boolean;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Stable pseudo-random bar heights — same URL → same shape every render.
  const bars = useMemo(() => generateBars(src, 36), [src]);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onLoaded = () => setDuration(a.duration || null);
    const onTime = () => setCurrentTime(a.currentTime || 0);
    const onEnded = () => {
      setPlaying(false);
      setCurrentTime(0);
    };
    const onError = () => setError("Couldn't load audio");
    a.addEventListener("loadedmetadata", onLoaded);
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("ended", onEnded);
    a.addEventListener("error", onError);
    return () => {
      a.removeEventListener("loadedmetadata", onLoaded);
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("ended", onEnded);
      a.removeEventListener("error", onError);
    };
  }, []);

  const toggle = async () => {
    const a = audioRef.current;
    if (!a) return;
    try {
      if (playing) {
        a.pause();
        setPlaying(false);
      } else {
        await a.play();
        setPlaying(true);
      }
    } catch (e) {
      setError("Playback failed");
      setPlaying(false);
      console.warn("[voice-player]", e);
    }
  };

  const progress =
    duration && duration > 0
      ? Math.min(1, Math.max(0, currentTime / duration))
      : 0;

  // WhatsApp colour palette: outbound = white-ish on green; inbound = dark
  // bars on a near-white surface.
  const playedCls = outbound ? "bg-white" : "bg-[rgb(var(--accent))]";
  const idleCls = outbound ? "bg-white/35" : "bg-[rgb(var(--fg-subtle))/0.45]";
  const btnCls = outbound
    ? "bg-white/25 text-white hover:bg-white/35"
    : "bg-[rgb(var(--accent))] text-white hover:opacity-90";
  const timeCls = outbound ? "text-white/75" : "text-[rgb(var(--fg-subtle))]";

  return (
    <div
      className={cn(
        "mb-1 flex w-full max-w-[18rem] items-center gap-3 rounded-xl px-2 py-1.5 sm:max-w-[20rem]",
        outbound
          ? "bg-white/10"
          : "border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))]",
      )}
    >
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? "Pause" : "Play"}
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors",
          btnCls,
        )}
      >
        {playing ? (
          <Pause className="h-4 w-4" />
        ) : (
          <Play className="ml-0.5 h-4 w-4" />
        )}
      </button>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Bar row with played/unplayed coloring. The progress is shown by
            switching each bar's class once it's "passed". */}
        <div className="flex h-7 items-center gap-[2px]">
          {bars.map((h, i) => {
            const passed = i / bars.length <= progress;
            return (
              <span
                key={i}
                className={cn(
                  "w-[3px] rounded-full transition-colors",
                  passed ? playedCls : idleCls,
                )}
                style={{ height: `${h}%` }}
              />
            );
          })}
        </div>
        <div className="mt-0.5 flex items-center justify-between gap-2 text-[10px] tabular-nums">
          <span className={timeCls}>
            {formatTime(playing ? currentTime : duration ?? 0)}
          </span>
          {error && (
            <span className="truncate text-rose-400" title={error}>
              {error}
            </span>
          )}
        </div>
      </div>

      <audio ref={audioRef} preload="metadata" src={src} className="hidden" />
    </div>
  );
}

function formatTime(s: number): string {
  if (!isFinite(s) || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, "0")}`;
}

/**
 * Deterministic pseudo-random bar heights (15–95%) derived from the URL.
 * Same URL → same shape every time the component re-renders, but every
 * message has its own unique-looking waveform.
 */
function generateBars(seed: string, count: number): number[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    h = Math.imul(h ^ (h >>> 13), 1597334677) >>> 0;
    const v = (h & 0xffff) / 0xffff; // 0..1
    // Bias toward middle so bars look "voice-shaped" rather than uniformly tall
    const shaped = 0.25 + 0.7 * Math.pow(v, 1.4);
    out.push(Math.round(shaped * 100));
  }
  return out;
}
