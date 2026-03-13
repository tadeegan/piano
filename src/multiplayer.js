/**
 * Multiplayer module — PeerJS-based WebRTC data channel manager.
 * Star topology: host relays all messages.
 * Room ID is a UUID used as the host's PeerJS peer ID, stored in ?room= URL param.
 */
import Peer from 'peerjs';
import engine from './engine';

const PEER_COLORS = ['#22c55e', '#a855f7', '#ec4899', '#06b6d4', '#eab308', '#ef4444'];

function generateRoomId() {
  // Short readable ID (8 chars)
  return crypto.randomUUID().slice(0, 8);
}

function setUrlRoom(id) {
  const url = new URL(window.location);
  url.searchParams.set('room', id);
  window.history.replaceState({}, '', url);
}

function clearUrlRoom() {
  const url = new URL(window.location);
  url.searchParams.delete('room');
  window.history.replaceState({}, '', url.pathname);
}

function getUrlRoom() {
  return new URLSearchParams(window.location.search).get('room');
}

function createMultiplayer() {
  let peer = null;
  let status = 'disconnected'; // 'disconnected' | 'hosting' | 'joined'
  let roomCode = null;
  let isHost = false;
  const peers = new Map(); // peerId -> { conn, name, color, sourceId }
  let colorIndex = 0;

  const statusListeners = new Set();
  const peersListeners = new Set();

  function notifyStatus() {
    statusListeners.forEach(fn => fn({ status, roomCode, isHost }));
  }

  function notifyPeers() {
    const snapshot = new Map(peers);
    peersListeners.forEach(fn => fn(snapshot));
  }

  function onStatusChange(fn) {
    statusListeners.add(fn);
    return () => statusListeners.delete(fn);
  }

  function onPeersChange(fn) {
    peersListeners.add(fn);
    return () => peersListeners.delete(fn);
  }

  function getStatus() { return { status, roomCode, isHost }; }
  function getPeers() { return new Map(peers); }

  function broadcast(msg) {
    const data = JSON.stringify(msg);
    for (const [, info] of peers) {
      if (info.conn.open) {
        info.conn.send(data);
      }
    }
  }

  function handleMessage(data, fromPeerId) {
    let msg;
    try {
      msg = typeof data === 'string' ? JSON.parse(data) : data;
    } catch { return; }

    if (msg.t === 'hello') {
      const info = peers.get(fromPeerId);
      if (info) {
        info.name = msg.name || 'Peer';
        engine.registerSource(info.sourceId, { name: info.name, color: info.color });
        notifyPeers();
      }
      return;
    }

    if (msg.t === 'on') {
      const sourceId = isHost ? (peers.get(fromPeerId)?.sourceId || fromPeerId) : msg.s;
      engine.noteOn(msg.m, msg.v || 90, sourceId);
      // Host relays to other peers
      if (isHost) {
        const relay = JSON.stringify({ t: 'on', m: msg.m, v: msg.v, s: sourceId });
        for (const [pid, info] of peers) {
          if (pid !== fromPeerId && info.conn.open) {
            info.conn.send(relay);
          }
        }
      }
      return;
    }

    if (msg.t === 'off') {
      const sourceId = isHost ? (peers.get(fromPeerId)?.sourceId || fromPeerId) : msg.s;
      engine.noteOff(msg.m, sourceId);
      // Host relays to other peers
      if (isHost) {
        const relay = JSON.stringify({ t: 'off', m: msg.m, s: sourceId });
        for (const [pid, info] of peers) {
          if (pid !== fromPeerId && info.conn.open) {
            info.conn.send(relay);
          }
        }
      }
      return;
    }
  }

  function addPeer(conn) {
    const color = PEER_COLORS[colorIndex % PEER_COLORS.length];
    colorIndex++;
    const sourceId = `peer-${conn.peer.slice(0, 6)}`;
    const info = { conn, name: 'Peer', color, sourceId };
    peers.set(conn.peer, info);

    engine.registerSource(sourceId, { name: 'Peer', color });

    conn.on('data', (data) => handleMessage(data, conn.peer));
    conn.on('close', () => removePeer(conn.peer));
    conn.on('error', () => removePeer(conn.peer));

    notifyPeers();
  }

  function removePeer(peerId) {
    const info = peers.get(peerId);
    if (info) {
      engine.unregisterSource(info.sourceId);
      try { info.conn.close(); } catch {}
      peers.delete(peerId);
      notifyPeers();
    }
  }

  const SESSION_KEY = 'piano-mp-room';

  function saveSession() {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ roomCode, isHost }));
    } catch {}
  }

  function clearSession() {
    try { sessionStorage.removeItem(SESSION_KEY); } catch {}
  }

  function hostRoom(existingId) {
    const id = existingId || generateRoomId();
    return new Promise((resolve, reject) => {
      // Use the room ID as the PeerJS peer ID
      peer = new Peer(id);

      peer.on('open', () => {
        roomCode = id;
        status = 'hosting';
        isHost = true;
        setUrlRoom(id);
        saveSession();
        notifyStatus();
        resolve(id);
      });

      peer.on('connection', (conn) => {
        conn.on('open', () => addPeer(conn));
      });

      peer.on('error', (err) => {
        if (status === 'disconnected') {
          clearSession();
          clearUrlRoom();
          reject(err);
        }
      });
    });
  }

  function joinRoom(code) {
    return new Promise((resolve, reject) => {
      peer = new Peer();

      peer.on('open', () => {
        const conn = peer.connect(code, { reliable: true });

        conn.on('open', () => {
          roomCode = code;
          status = 'joined';
          isHost = false;
          setUrlRoom(code);
          saveSession();

          const hostSourceId = 'host';

          conn.on('data', (data) => handleMessage(data, code));
          conn.on('close', () => disconnect());
          conn.on('error', () => disconnect());

          peers.set(code, { conn, name: 'Host', color: '#3b82f6', sourceId: hostSourceId });

          conn.send(JSON.stringify({ t: 'hello', name: 'Peer' }));

          notifyStatus();
          notifyPeers();
          resolve();
        });

        conn.on('error', (err) => {
          clearSession();
          clearUrlRoom();
          reject(err);
        });
      });

      peer.on('error', (err) => {
        clearSession();
        clearUrlRoom();
        reject(err);
      });
    });
  }

  function disconnect() {
    clearSession();
    clearUrlRoom();
    // Unregister all peer sources
    for (const [, info] of peers) {
      engine.unregisterSource(info.sourceId);
      try { info.conn.close(); } catch {}
    }
    peers.clear();
    colorIndex = 0;

    if (peer) {
      try { peer.destroy(); } catch {}
      peer = null;
    }

    status = 'disconnected';
    roomCode = null;
    isHost = false;
    notifyStatus();
    notifyPeers();
  }

  // Auto-rejoin on load from URL + sessionStorage
  function tryRestore() {
    try {
      const urlRoom = getUrlRoom();
      if (!urlRoom) return;

      const saved = sessionStorage.getItem(SESSION_KEY);
      if (saved) {
        const { roomCode: code, isHost: wasHost } = JSON.parse(saved);
        // Session matches URL — restore role
        if (code === urlRoom) {
          if (wasHost) {
            hostRoom(code).catch(() => { clearSession(); clearUrlRoom(); });
          } else {
            joinRoom(code).catch(() => { clearSession(); clearUrlRoom(); });
          }
          return;
        }
      }

      // URL has ?room= but no matching session — join as peer
      joinRoom(urlRoom).catch(() => { clearSession(); clearUrlRoom(); });
    } catch {
      clearSession();
      clearUrlRoom();
    }
  }

  tryRestore();

  return {
    hostRoom,
    joinRoom,
    disconnect,
    broadcast,
    getStatus,
    getPeers,
    onStatusChange,
    onPeersChange,
  };
}

const multiplayer = createMultiplayer();
export default multiplayer;
