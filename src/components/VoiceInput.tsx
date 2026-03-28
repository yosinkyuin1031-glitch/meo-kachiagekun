"use client";

import { useState, useRef, useEffect } from "react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SpeechRecognitionInstance = any;

interface Props {
  onResult: (text: string) => void;
  placeholder?: string;
}

export default function VoiceInput({ onResult, placeholder }: Props) {
  const [isRecording, setIsRecording] = useState(false);
  const [interim, setInterim] = useState("");
  const [supported, setSupported] = useState(true);
  const recognitionRef = useRef<SpeechRecognitionInstance>(null);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const SpeechRecognitionClass = w.webkitSpeechRecognition || w.SpeechRecognition;
    if (!SpeechRecognitionClass) {
      setSupported(false);
      return;
    }
    const recognition = new SpeechRecognitionClass();
    recognition.lang = "ja-JP";
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event: { results: SpeechRecognitionResultList }) => {
      let finalText = "";
      let interimText = "";
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalText += result[0].transcript;
        } else {
          interimText += result[0].transcript;
        }
      }
      setInterim(interimText);
      if (finalText) {
        onResult(finalText);
      }
    };

    recognition.onerror = () => {
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
      setInterim("");
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleRecording = () => {
    if (!recognitionRef.current) return;
    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    } else {
      setInterim("");
      recognitionRef.current.start();
      setIsRecording(true);
    }
  };

  if (!supported) {
    return (
      <span className="text-xs text-gray-400" title="このブラウザは音声入力に対応していません">
        音声入力非対応
      </span>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={toggleRecording}
        title={placeholder || "音声入力"}
        className={`relative flex items-center justify-center w-10 h-10 rounded-full transition-all ${
          isRecording
            ? "bg-red-500 text-white shadow-lg"
            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
        }`}
      >
        {/* Pulsing indicator */}
        {isRecording && (
          <span className="absolute inset-0 rounded-full bg-red-400 animate-ping opacity-40" />
        )}
        {/* Microphone icon */}
        <svg className="w-5 h-5 relative z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"
          />
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 10v2a7 7 0 01-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="23" strokeLinecap="round" />
          <line x1="8" y1="23" x2="16" y2="23" strokeLinecap="round" />
        </svg>
      </button>
      {isRecording && interim && (
        <span className="text-xs text-gray-500 italic max-w-[200px] truncate">
          {interim}
        </span>
      )}
    </div>
  );
}
