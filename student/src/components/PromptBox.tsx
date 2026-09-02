import { useRef, useEffect, useCallback, useState } from "react";
import { ArrowUp, Microphone, Stop } from "@phosphor-icons/react";
import { speechToText } from "../api";

interface PromptBoxProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit: (v: string) => void;
  disabled?: boolean;
  footnote?: string;
  placeholder?: string;
}

const MAX_H = 160;

export default function PromptBox({
  value,
  onChange,
  onSubmit,
  disabled,
  footnote,
  placeholder = "ask about a subject…",
}: PromptBoxProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);

  const resize = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_H)}px`;
  }, []);

  useEffect(resize, [value, resize]);

  function send() {
    const text = value.trim();
    if (!text || disabled) return;
    onSubmit(text);
  }

  async function toggleMic() {
    if (recording) {
      mediaRef.current?.stop();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      chunksRef.current = [];
      mediaRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        setTranscribing(true);

        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        try {
          const text = await speechToText(blob);
          // onChange takes a string, not an updater — read the current value
          // from props. As an updater this silently discarded the transcript.
          onChange(value ? `${value} ${text}` : text);
        } catch (e) {
          console.error("STT failed:", e);
        } finally {
          setTranscribing(false);
        }
      };

      recorder.start();
      setRecording(true);
    } catch {
      alert("Microphone access denied.");
    }
  }

  const hasContent = value.trim().length > 0;
  const busy = disabled || transcribing;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-30 px-4 pb-4 pt-10 sm:px-6"
      style={{
        background:
          "linear-gradient(to top, var(--color-paper) 60%, transparent)",
      }}
    >
      <div className="mx-auto max-w-[860px]">
        <div className="flex items-end gap-2 rounded-2xl border border-line bg-paper-2 px-4 py-3 shadow-[0_4px_24px_rgba(0,0,0,0.07)] transition-all focus-within:border-ink/30 focus-within:shadow-[0_4px_28px_rgba(0,0,0,0.11)]">
          <textarea
            ref={ref}
            rows={1}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            disabled={busy}
            placeholder={
              recording
                ? "Listening…"
                : transcribing
                ? "Transcribing…"
                : placeholder
            }
            className="max-h-40 min-h-[28px] flex-1 resize-none bg-transparent text-[15px] leading-relaxed text-ink outline-none placeholder:text-ink-2/50"
          />
          <div className="mb-0.5 flex items-center gap-2">
            <button
              onClick={toggleMic}
              disabled={busy}
              aria-label={recording ? "Stop recording" : "Voice input"}
              className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl transition-all ${
                recording
                  ? "bg-red-500 text-white animate-pulse"
                  : "bg-transparent text-ink-2 hover:text-ink hover:bg-ink/5"
              }`}
            >
              {recording ? (
                <Stop size={16} weight="bold" />
              ) : (
                <Microphone size={16} weight="bold" />
              )}
            </button>
            <kbd className="hidden select-none text-[10px] tracking-wide text-ink-2/40 sm:block">
              {hasContent ? "⏎" : ""}
            </kbd>
            <button
              onClick={send}
              disabled={!hasContent || busy}
              aria-label="Send"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-ink text-paper transition-all hover:bg-ink/85 disabled:opacity-15"
            >
              <ArrowUp size={16} weight="bold" />
            </button>
          </div>
        </div>
        {footnote && (
          <p className="mt-2 text-center font-mono text-[10px] tracking-wide text-ink-2/40">
            {footnote}
          </p>
        )}
      </div>
    </div>
  );
}
