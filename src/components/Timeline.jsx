import { useRef, useEffect } from 'react';
import engine from '../engine';

const PX_PER_MS = 0.12;

function isBlackKey(midi) {
  return [1, 3, 6, 8, 10].includes(midi % 12);
}

function getNotePosition(note) {
  const startNote = 21;
  let whiteKeyCount = 0;
  if (isBlackKey(note)) {
    for (let n = startNote; n < note; n++) {
      if (!isBlackKey(n)) whiteKeyCount++;
    }
    return whiteKeyCount - 1;
  } else {
    for (let n = startNote; n < note; n++) {
      if (!isBlackKey(n)) whiteKeyCount++;
    }
    return whiteKeyCount;
  }
}

function getNoteX(midi, keyWidth) {
  const pos = getNotePosition(midi);
  if (isBlackKey(midi)) {
    return pos * keyWidth + keyWidth * 0.67;
  }
  return pos * keyWidth;
}

function getNoteWidth(midi, keyWidth) {
  return isBlackKey(midi) ? keyWidth * 0.67 : keyWidth;
}

export default function Timeline({ events, heldNotes, breaks, inBreak, keyWidth, pianoLeftPadding, timeOrigin }) {
  const containerRef = useRef(null);
  const trackRef = useRef(null);
  const rafRef = useRef(null);
  const timeOriginRef = useRef(timeOrigin);
  const heldNotesRef = useRef(heldNotes);

  useEffect(() => { timeOriginRef.current = timeOrigin; }, [timeOrigin]);
  useEffect(() => { heldNotesRef.current = heldNotes; }, [heldNotes]);

  useEffect(() => {
    const animate = () => {
      const track = trackRef.current;
      const container = containerRef.current;
      const origin = timeOriginRef.current;

      if (track && container && origin != null) {
        const elapsed = engine.getEffectiveElapsed();
        const containerH = container.clientHeight;

        track.style.transform = `translateY(${containerH - elapsed * PX_PER_MS}px)`;

        // Grow held notes downward in real-time
        const held = heldNotesRef.current;
        if (held) {
          for (const [midi, info] of held.entries()) {
            const el = track.querySelector(`[data-held="${midi}"]`);
            if (el) {
              const h = Math.max(3, (elapsed - info.globalTime) * PX_PER_MS);
              el.style.height = `${h}px`;
            }
          }
        }
      }

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, []);

  return (
    <div
      ref={containerRef}
      className="w-full flex-1 min-h-0 border-x-2 border-t-2 border-[#2a2d35] bg-[#0a0b0e] overflow-hidden relative"
      style={{ boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.9)' }}
    >
      {events.length === 0 && (!heldNotes || heldNotes.size === 0) && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[#3a3f4c] text-xs font-semibold tracking-wide uppercase">
            Play some notes...
          </span>
        </div>
      )}

      {/* Track: positioned at top:0, shifted via translateY so "now" = container bottom */}
      <div ref={trackRef} className="absolute top-0 left-0 right-0" style={{ willChange: 'transform' }}>
        {/* Completed notes */}
        {events.map((e, i) => {
          const x = pianoLeftPadding + getNoteX(e.midi, keyWidth);
          const w = getNoteWidth(e.midi, keyWidth);
          const topPx = e.globalTime * PX_PER_MS;
          const h = Math.max(3, e.duration * PX_PER_MS);
          const isUser = e.source === 'user';

          return (
            <div
              key={`done-${i}`}
              className={`absolute rounded-[3px] ${
                isUser
                  ? 'bg-blue-500/90 shadow-[0_0_6px_rgba(59,130,246,0.4)]'
                  : 'bg-orange-500/90 shadow-[0_0_6px_rgba(249,115,22,0.4)]'
              }`}
              style={{
                left: x,
                top: topPx,
                width: w - 1,
                height: h,
              }}
            />
          );
        })}

        {/* Held notes — grow downward from start time */}
        {heldNotes && [...heldNotes.entries()].map(([midi, info]) => {
          const x = pianoLeftPadding + getNoteX(midi, keyWidth);
          const w = getNoteWidth(midi, keyWidth);
          const topPx = info.globalTime * PX_PER_MS;
          const isUser = info.source === 'user';

          return (
            <div
              key={`held-${midi}`}
              data-held={midi}
              className={`absolute rounded-[3px] ${
                isUser
                  ? 'bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.6)]'
                  : 'bg-orange-400 shadow-[0_0_8px_rgba(251,146,60,0.6)]'
              }`}
              style={{
                left: x,
                top: topPx,
                width: w - 1,
                height: 3,
              }}
            />
          );
        })}

        {/* Break indicators */}
        {breaks && breaks.map((b, i) => (
          <div
            key={`break-${i}`}
            className="absolute left-0 right-0 flex items-center"
            style={{ top: b.globalTime * PX_PER_MS - 1 }}
          >
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-yellow-500/60 to-transparent" />
            <span className="px-2 text-[9px] font-bold tracking-widest uppercase text-yellow-500/70 whitespace-nowrap">
              break
            </span>
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-yellow-500/60 to-transparent" />
          </div>
        ))}
      </div>

      {/* "Now" line at the bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-white/10 shadow-[0_0_8px_rgba(255,255,255,0.15)]" />

      {/* Break/paused overlay */}
      {inBreak && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1.5 rounded-full bg-yellow-500/15 border border-yellow-500/30 backdrop-blur-sm">
          <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
          <span className="text-[10px] font-bold tracking-widest uppercase text-yellow-500/90">
            Paused
          </span>
        </div>
      )}
    </div>
  );
}
