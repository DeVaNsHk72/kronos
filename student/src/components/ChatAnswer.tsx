import { useState, useRef } from "react";
import { SpeakerHigh, Stop } from "@phosphor-icons/react";
import type { ChatCitation } from "../api";
import { textToSpeech } from "../api";

/** Render [3] and [2][7] as buttons that jump to the cited question. */
function withCitations(
  text: string,
  valid: Set<number>,
  onJump: (n: number) => void,
) {
  return text.split(/(\[\d+\])/g).map((part, i) => {
    const m = part.match(/^\[(\d+)\]$/);
    if (!m) return <span key={i}>{part}</span>;
    const n = Number(m[1]);
    if (!valid.has(n)) return <span key={i} className="text-ink-2">{part}</span>;
    return (
      <button
        key={i}
        onClick={() => onJump(n)}
        title={`Jump to question ${n}`}
        className="mx-0.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[4px] border border-blueprint/30 bg-blueprint/8 px-1 align-[1px] font-mono text-[10px] font-semibold text-blueprint transition-colors hover:bg-blueprint hover:text-paper"
      >
        {n}
      </button>
    );
  });
}

export default function ChatAnswer({
  answer,
  citations,
  onJump,
}: {
  answer: string;
  citations: ChatCitation[];
  onJump: (n: number) => void;
}) {
  const valid = new Set(citations.map((c) => c.n));
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  async function toggleSpeak() {
    if (playing) {
      audioRef.current?.pause();
      audioRef.current = null;
      setPlaying(false);
      return;
    }

    // strip citation markers for cleaner speech
    const clean = answer.replace(/\[\d+\]/g, "").trim();
    if (!clean) return;

    setLoading(true);
    try {
      const url = await textToSpeech(clean);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        setPlaying(false);
        URL.revokeObjectURL(url);
      };
      await audio.play();
      setPlaying(true);
    } catch (e) {
      console.error("TTS failed:", e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="whitespace-pre-wrap serif text-[16px] leading-relaxed text-ink">
        {withCitations(answer, valid, onJump)}
      </div>
      <button
        onClick={toggleSpeak}
        disabled={loading}
        aria-label={playing ? "Stop speaking" : "Read aloud"}
        className={`mt-2 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-[background-color,color] duration-150 ease-out ${
          playing
            ? "bg-red-500/10 text-red-600 hover:bg-red-500/20"
            : "bg-ink/5 text-ink-2 hover:text-ink hover:bg-ink/10"
        }`}
      >
        {playing ? <Stop size={14} weight="bold" /> : <SpeakerHigh size={14} weight="bold" />}
        {loading ? "Loading…" : playing ? "Stop" : "Listen"}
      </button>
    </div>
  );
}
