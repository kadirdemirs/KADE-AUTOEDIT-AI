import { useCallback, useEffect, useRef, useState } from "react";
import { WebSocketEvent } from "../types";
import { wsService } from "../services/websocket";

interface UseWebSocketReturn {
  isConnected: boolean;
  lastEvent: WebSocketEvent | null;
  subscribe: (handler: (e: WebSocketEvent) => void) => () => void;
}

export function useWebSocket(): UseWebSocketReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<WebSocketEvent | null>(null);

  useEffect(() => {
    wsService.connect();

    const checkInterval = setInterval(() => {
      setIsConnected(wsService.isConnected);
    }, 1000);

    const unsub = wsService.onMessage((e) => {
      setLastEvent(e);
      setIsConnected(true);
    });

    return () => {
      clearInterval(checkInterval);
      unsub();
      wsService.disconnect();
    };
  }, []);

  const subscribe = useCallback((handler: (e: WebSocketEvent) => void) => {
    return wsService.onMessage(handler);
  }, []);

  return { isConnected, lastEvent, subscribe };
}
