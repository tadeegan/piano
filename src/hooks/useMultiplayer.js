import { useRef, useCallback, useSyncExternalStore } from 'react';
import multiplayer from '../multiplayer';

export function useMultiplayer() {
  const statusRef = useRef(multiplayer.getStatus());
  const peersRef = useRef(multiplayer.getPeers());

  const subscribeStatus = useCallback((cb) => multiplayer.onStatusChange((s) => {
    statusRef.current = s;
    cb();
  }), []);

  const getStatusSnapshot = useCallback(() => statusRef.current, []);
  const { status, roomCode, isHost } = useSyncExternalStore(subscribeStatus, getStatusSnapshot);

  const subscribePeers = useCallback((cb) => multiplayer.onPeersChange((s) => {
    peersRef.current = s;
    cb();
  }), []);

  const getPeersSnapshot = useCallback(() => peersRef.current, []);
  const peers = useSyncExternalStore(subscribePeers, getPeersSnapshot);

  return {
    status,
    roomCode,
    isHost,
    peers,
    hostRoom: multiplayer.hostRoom,
    joinRoom: multiplayer.joinRoom,
    disconnect: multiplayer.disconnect,
  };
}
