import { useRef, useEffect, useMemo } from 'react';
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

/** Build bar/beat grid lines for all segments */
function buildGridLines(segments, breaks, bpm, beatsPerMeasure, effectiveElapsed) {
  if (segments.length === 0 || bpm <= 0) return [];

  const msPerBeat = 60000 / bpm;
  const msPerBar = msPerBeat * beatsPerMeasure;
  const lines = [];

  for (let si = 0; si < segments.length; si++) {
    const segStart = segments[si].startTime;
    // Segment ends at next break or current time
    let segEnd;
    if (si < breaks.length) {
      // This segment ends at break[si] (break i corresponds to the end of segment i)
      segEnd = breaks[si].globalTime;
    } else {
      // Last segment: extends to current time
      segEnd = effectiveElapsed;
    }

    const segDuration = segEnd - segStart;
    if (segDuration <= 0) continue;

    // How many beats fit in this segment
    const totalBeats = Math.ceil(segDuration / msPerBeat) + 1;

    for (let b = 0; b < totalBeats; b++) {
      const timeInSegment = b * msPerBeat;
      if (timeInSegment > segDuration) break;

      const globalTime = segStart + timeInSegment;
      const beatInBar = b % beatsPerMeasure;
      const barNumber = Math.floor(b / beatsPerMeasure) + 1;
      const isBarLine = beatInBar === 0;

      lines.push({
        globalTime,
        isBarLine,
        barNumber,
        beatInBar: beatInBar + 1,
      });
    }
  }

  return lines;
}

export default function Timeline({ events, heldNotes, breaks, segments, inBreak, bpm, beatsPerMeasure, keyWidth, pianoLeftPadding, timeOrigin, sources }) {
  const containerRef = useRef(null);
  const trackRef = useRef(null);
  const rafRef = useRef(null);
  const timeOriginRef = useRef(timeOrigin);
  const heldNotesRef = useRef(heldNotes);

  useEffect(() => { timeOriginRef.current = timeOrigin; }, [timeOrigin]);
  useEffect(() => { heldNotesRef.current = heldNotes; }, [heldNotes]);

  const effectiveElapsed = engine.getEffectiveElapsed();

  const gridLines = useMemo(
    () => buildGridLines(segments || [], breaks || [], bpm || 120, beatsPerMeasure || 4, effectiveElapsed),
    [segments, breaks, bpm, beatsPerMeasure, effectiveElapsed]
  );

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
        {/* Bar & beat grid lines */}
        {gridLines.map((line, i) => (
          <div
            key={`grid-${i}`}
            className="absolute left-0 right-0"
            style={{ top: line.globalTime * PX_PER_MS }}
          >
            <div
              className={`w-full ${line.isBarLine ? 'h-px' : 'h-px'}`}
              style={{
                background: line.isBarLine
                  ? 'rgba(255,255,255,0.12)'
                  : 'rgba(255,255,255,0.04)',
              }}
            />
            {line.isBarLine && (
              <span
                className="absolute text-[9px] font-mono text-white/20 select-none"
                style={{ left: 4, top: -10 }}
              >
                {line.barNumber}
              </span>
            )}
          </div>
        ))}

        {/* Completed notes */}
        {events.map((e, i) => {
          const x = pianoLeftPadding + getNoteX(e.midi, keyWidth);
          const w = getNoteWidth(e.midi, keyWidth);
          const topPx = e.globalTime * PX_PER_MS;
          const h = Math.max(3, e.duration * PX_PER_MS);
          const sourceInfo = sources && sources.get(e.source);
          const color = sourceInfo ? sourceInfo.color : (e.source === 'user' ? '#3b82f6' : '#f97316');

          return (
            <div
              key={`done-${i}`}
              className="absolute rounded-[3px]"
              style={{
                left: x,
                top: topPx,
                width: w - 1,
                height: h,
                backgroundColor: color,
                opacity: 0.9,
                boxShadow: `0 0 6px ${color}66`,
              }}
            />
          );
        })}

        {/* Held notes — grow downward from start time */}
        {heldNotes && [...heldNotes.entries()].map(([midi, info]) => {
          const x = pianoLeftPadding + getNoteX(midi, keyWidth);
          const w = getNoteWidth(midi, keyWidth);
          const topPx = info.globalTime * PX_PER_MS;
          const sourceInfo = sources && sources.get(info.source);
          const color = sourceInfo ? sourceInfo.color : (info.source === 'user' ? '#3b82f6' : '#f97316');

          return (
            <div
              key={`held-${midi}`}
              data-held={midi}
              className="absolute rounded-[3px]"
              style={{
                left: x,
                top: topPx,
                width: w - 1,
                height: 3,
                backgroundColor: color,
                boxShadow: `0 0 8px ${color}99`,
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
