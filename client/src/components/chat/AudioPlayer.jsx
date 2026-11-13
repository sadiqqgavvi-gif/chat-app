import { useEffect, useRef, useState } from "react";
import { FiPause, FiPlay } from "react-icons/fi";
import { formatDuration } from "../../lib/format";

const SPEEDS = [1, 1.5, 2];
// Only one voice message plays at a time.
let activeAudio = null;

function AudioPlayer({ src, duration, mine }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [total, setTotal] = useState(duration || 0);
  const [speed, setSpeed] = useState(1);

  useEffect(() => {
    const audio = audioRef.current;
    return () => {
      audio.pause();
      if (activeAudio === audio) activeAudio = null;
    };
  }, []);

  const toggle = () => {
    const audio = audioRef.current;
    if (audio.paused) {
      if (activeAudio && activeAudio !== audio) activeAudio.pause();
      activeAudio = audio;
      audio.playbackRate = speed;
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  };

  const cycleSpeed = () => {
    const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
    setSpeed(next);
    audioRef.current.playbackRate = next;
  };

  const seek = (event) => {
    const value = Number(event.target.value);
    audioRef.current.currentTime = value;
    setCurrent(value);
  };

  return (
    <div className="flex w-64 max-w-full items-center gap-2.5 py-1">
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setCurrent(0);
        }}
        onTimeUpdate={(event) => setCurrent(event.currentTarget.currentTime)}
        onLoadedMetadata={(event) => {
          // Recordings made in the browser often report an unknown length.
          const length = event.currentTarget.duration;
          if (Number.isFinite(length) && length > 0) setTotal(length);
        }}
      />
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? "Pause" : "Play"}
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg ${
          mine
            ? "bg-white/20 hover:bg-white/30"
            : "bg-brand text-white hover:bg-brand-strong"
        }`}
      >
        {playing ? <FiPause /> : <FiPlay className="translate-x-px" />}
      </button>

      <div className="min-w-0 flex-1">
        <input
          type="range"
          min={0}
          max={total || 1}
          step={0.05}
          value={Math.min(current, total || 1)}
          onChange={seek}
          aria-label="Seek"
          className={`block h-1 w-full cursor-pointer ${mine ? "accent-white" : "accent-brand"}`}
        />
        <div className="mt-1 text-[11px] tabular-nums opacity-75">
          {formatDuration(playing || current > 0 ? current : total)}
        </div>
      </div>

      <button
        type="button"
        onClick={cycleSpeed}
        aria-label="Playback speed"
        className={`w-9 shrink-0 rounded-full py-0.5 text-[11px] font-semibold ${
          mine ? "bg-white/20" : "bg-soft text-muted"
        }`}
      >
        {speed}×
      </button>
    </div>
  );
}

export default AudioPlayer;
