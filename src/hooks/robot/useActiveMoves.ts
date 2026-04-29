import { useEffect, useRef } from 'react';
import useAppStore from '../../store/useAppStore';
import { getWsBaseUrl, buildApiUrl, fetchWithTimeout, DAEMON_CONFIG } from '../../config/daemon';

/**
 * WebSocket updates emitted by /api/move/ws/updates.
 */
type MoveUpdateType = 'move_started' | 'move_completed' | 'move_failed' | 'move_cancelled';

interface MoveUpdate {
  type: MoveUpdateType;
  uuid: string;
  details?: string;
}

interface ActiveMove {
  uuid: string;
  [key: string]: unknown;
}

type TimeoutId = ReturnType<typeof setTimeout>;

// Fallback poll interval: guards against a live-but-silent WebSocket where the
// daemon emits move_started but never emits move_completed (observed on daemon
// v1.7.0). The WS remains the fast path; the poll provides a ~3 s safety net.
const MOVE_POLL_INTERVAL_MS = 3000;

// Exponential backoff mirroring useRobotStateWebSocket — no hard attempt cap so
// the WebSocket recovers from prolonged network hiccups (e.g. Crostini proxy
// drops) without requiring an app restart.
const WS_RECONNECT_INITIAL_DELAY_MS = 1000;
const WS_RECONNECT_MAX_DELAY_MS = 30000;
const WS_BACKOFF_FACTOR = 2;
const WS_JITTER_RATIO = 0.2;

function computeReconnectDelay(attempt: number): number {
  const raw = WS_RECONNECT_INITIAL_DELAY_MS * Math.pow(WS_BACKOFF_FACTOR, attempt);
  const capped = Math.min(raw, WS_RECONNECT_MAX_DELAY_MS);
  const jitter = capped * WS_JITTER_RATIO * (Math.random() * 2 - 1);
  return Math.max(WS_RECONNECT_INITIAL_DELAY_MS, Math.floor(capped + jitter));
}

/**
 * 🎯 Real-time hook for active moves via WebSocket
 *
 * Responsibilities:
 * - Connect to /api/move/ws/updates WebSocket
 * - Receive real-time updates when moves start/stop
 * - Update activeMoves in store
 *
 * Replaces the old polling of GET /api/move/running every 500ms.
 *
 * Benefits:
 * - ⚡ Real-time updates (no 500ms lag)
 * - 🚀 Less network overhead
 * - 🎯 Instant notification when moves complete
 */
export function useActiveMoves(isActive: boolean): void {
  const { setActiveMoves, isDaemonCrashed } = useAppStore();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<TimeoutId | null>(null);
  const isMountedRef = useRef<boolean>(true);
  const reconnectAttemptsRef = useRef<number>(0);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;

      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    // Don't connect if not active or daemon crashed
    if (!isActive || isDaemonCrashed) {
      // Cleanup existing connection
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }

      // Clear active moves when not active
      if (!isActive) {
        setActiveMoves([]);
      }

      return;
    }

    // Fetch initial list of active moves via HTTP
    const fetchInitialMoves = async (): Promise<void> => {
      try {
        const response: Response = await fetchWithTimeout(
          buildApiUrl('/api/move/running'),
          {},
          DAEMON_CONFIG.TIMEOUTS.COMMAND,
          { silent: true }
        );

        if (response.ok && isMountedRef.current) {
          const data = (await response.json()) as unknown;
          if (Array.isArray(data)) {
            setActiveMoves(data);
          }
        }
      } catch {
        // Ignore errors on initial fetch (WebSocket will handle updates).
      }
    };

    const connectWebSocket = (): void => {
      try {
        const wsUrl = `${getWsBaseUrl()}/api/move/ws/updates`;
        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          reconnectAttemptsRef.current = 0; // Reset on successful connection

          // Fetch current running moves: the WebSocket only sends deltas so we
          // need a snapshot on (re)connect to recover any missed completions.
          fetchInitialMoves();
        };

        ws.onmessage = (event: MessageEvent<string>) => {
          if (!isMountedRef.current) return;

          try {
            const data = JSON.parse(event.data) as MoveUpdate;

            // Expected WebSocket update shapes:
            //   { "type": "move_started", "uuid": "...", "details": "" }
            //   { "type": "move_completed", "uuid": "...", "details": "" }
            //   { "type": "move_failed", "uuid": "...", "details": "..." }
            //   { "type": "move_cancelled", "uuid": "...", "details": "" }

            if (data.type === 'move_started') {
              setActiveMoves(prev => {
                const moves = prev as ActiveMove[];
                const exists = moves.some(m => m.uuid === data.uuid);
                if (exists) return moves;
                return [...moves, { uuid: data.uuid }];
              });
            } else if (
              data.type === 'move_completed' ||
              data.type === 'move_failed' ||
              data.type === 'move_cancelled'
            ) {
              setActiveMoves(prev => (prev as ActiveMove[]).filter(m => m.uuid !== data.uuid));
            }
          } catch {
            // Malformed message - skip.
          }
        };

        ws.onerror = () => {
          // Errors flow through onclose - nothing actionable here.
        };

        ws.onclose = () => {
          if (!isMountedRef.current) return;

          wsRef.current = null;

          if (isActive && !isDaemonCrashed) {
            const delay = computeReconnectDelay(reconnectAttemptsRef.current);
            reconnectAttemptsRef.current += 1;

            reconnectTimeoutRef.current = setTimeout(() => {
              if (isMountedRef.current && isActive && !isDaemonCrashed) {
                connectWebSocket();
              }
            }, delay);
          }
        };

        wsRef.current = ws;
      } catch {
        // WebSocket constructor can throw on invalid URLs - skip.
      }
    };

    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
  }, [isActive, isDaemonCrashed, setActiveMoves]);

  // HTTP fallback: poll /api/move/running every MOVE_POLL_INTERVAL_MS as a
  // safety net for moves that the WebSocket never completes (daemon bug, silent
  // WS, etc.). Replaces activeMoves with ground-truth from the daemon.
  useEffect(() => {
    if (!isActive || isDaemonCrashed) return;

    const interval = setInterval(async () => {
      if (!isMountedRef.current) return;
      try {
        const response = await fetchWithTimeout(
          buildApiUrl('/api/move/running'),
          {},
          DAEMON_CONFIG.TIMEOUTS.COMMAND,
          { silent: true }
        );
        if (response.ok && isMountedRef.current) {
          const data = (await response.json()) as unknown;
          if (Array.isArray(data)) {
            setActiveMoves(data);
          }
        }
      } catch {
        // Ignore poll errors — WebSocket handles real-time updates.
      }
    }, MOVE_POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [isActive, isDaemonCrashed, setActiveMoves]);
}
