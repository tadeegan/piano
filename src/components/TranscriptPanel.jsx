import { useRef, useEffect } from 'react';

export default function TranscriptPanel({ transcript, listening, visible }) {
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 z-50 w-[400px] max-h-[200px] bg-black/90 border border-[#333] rounded-tr-lg overflow-hidden flex flex-col font-mono text-[11px]">
      <div className="flex items-center justify-between px-2 py-1 bg-[#111] border-b border-[#333]">
        <span className="text-gray-500 uppercase tracking-wider text-[9px] font-bold">
          Speech Transcript
        </span>
        <span className={`w-2 h-2 rounded-full ${listening ? 'bg-red-500 animate-pulse' : 'bg-gray-600'}`} />
      </div>
      <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-0.5">
        {transcript.length === 0 && (
          <span className="text-gray-600 italic">No transcript yet...</span>
        )}
        {transcript.map((entry, i) => (
          <div
            key={i}
            className={entry.type === 'interim' ? 'text-gray-500 italic' : 'text-green-400'}
          >
            <span className="text-gray-600 mr-1">
              {new Date(entry.time).toLocaleTimeString('en', { hour12: false })}
            </span>
            {entry.text}
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </div>
  );
}
