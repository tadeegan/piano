import { useState } from 'react';
import { useMultiplayer } from '../hooks/useMultiplayer';
import { useSources } from '../hooks/useEngine';
import engine from '../engine';

export default function RoomPanel() {
  const { status, roomCode, isHost, peers, hostRoom, joinRoom, disconnect } = useMultiplayer();
  const sources = useSources();
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleHost = async () => {
    setLoading(true);
    try { await hostRoom(); } catch (e) { console.error('Host failed:', e); }
    setLoading(false);
  };

  const handleJoin = async () => {
    if (!joinCode.trim()) return;
    setLoading(true);
    try { await joinRoom(joinCode.trim()); } catch (e) { console.error('Join failed:', e); }
    setLoading(false);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const toggleMute = (sourceId) => {
    if (engine.isSourceMuted(sourceId)) {
      engine.unmuteSource(sourceId);
    } else {
      engine.muteSource(sourceId);
    }
  };

  if (status === 'disconnected') {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={handleHost}
          disabled={loading}
          className="px-2.5 py-1 text-[10px] font-bold tracking-wide uppercase rounded bg-green-600/80 hover:bg-green-600 text-white transition-colors disabled:opacity-50"
        >
          Host
        </button>
        <input
          type="text"
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
          placeholder="Room code"
          className="w-28 px-2 py-1 text-[10px] bg-[#0f1014] border border-[#3a3f4c] rounded text-gray-300 placeholder-gray-600 focus:outline-none focus:border-blue-500"
        />
        <button
          onClick={handleJoin}
          disabled={loading || !joinCode.trim()}
          className="px-2.5 py-1 text-[10px] font-bold tracking-wide uppercase rounded bg-blue-600/80 hover:bg-blue-600 text-white transition-colors disabled:opacity-50"
        >
          Join
        </button>
      </div>
    );
  }

  // Connected state
  const peerList = [];
  for (const [, info] of peers) {
    // Don't show the host connection entry for joined peers
    if (!isHost && info.sourceId === 'host') continue;
    peerList.push(info);
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={handleCopy}
        className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-mono bg-[#0f1014] border border-[#3a3f4c] rounded text-gray-300 hover:border-gray-500 transition-colors cursor-pointer"
        title="Click to copy join link"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
        {copied ? 'Copied!' : (roomCode.slice(0, 12) + (roomCode.length > 12 ? '...' : ''))}
      </button>

      {isHost && <span className="text-[9px] font-bold uppercase text-green-500/70">Host</span>}

      {/* Peer dots */}
      {peerList.map((info) => (
        <button
          key={info.sourceId}
          onClick={() => toggleMute(info.sourceId)}
          className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-white/5 transition-colors"
          title={`${info.name} — click to ${engine.isSourceMuted(info.sourceId) ? 'unmute' : 'mute'}`}
        >
          <span
            className="w-2 h-2 rounded-full"
            style={{
              backgroundColor: info.color,
              opacity: engine.isSourceMuted(info.sourceId) ? 0.3 : 1,
            }}
          />
          <span className="text-[9px] text-gray-400">{info.name}</span>
        </button>
      ))}

      {/* Source mute toggles for user/ai */}
      {[...sources.entries()].filter(([id]) => id === 'user' || id === 'ai').map(([id, info]) => (
        <button
          key={id}
          onClick={() => toggleMute(id)}
          className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-white/5 transition-colors"
          title={`${info.name} — click to ${engine.isSourceMuted(id) ? 'unmute' : 'mute'}`}
        >
          <span
            className="w-2 h-2 rounded-full"
            style={{
              backgroundColor: info.color,
              opacity: engine.isSourceMuted(id) ? 0.3 : 1,
            }}
          />
          <span className="text-[9px] text-gray-400">{info.name}</span>
        </button>
      ))}

      <button
        onClick={disconnect}
        className="px-2 py-1 text-[10px] font-bold tracking-wide uppercase rounded bg-red-600/60 hover:bg-red-600 text-white transition-colors"
      >
        Leave
      </button>
    </div>
  );
}
