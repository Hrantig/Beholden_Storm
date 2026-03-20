/**
 * ws.tsx — Singleton WebSocket layer for web-player.
 * Identical pattern to web-dm/src/services/ws.tsx.
 */

import React, { createContext, useContext, useEffect, useRef } from "react";

export type WsMessage = { type: string; payload?: unknown };
type Handler = (msg: WsMessage) => void;

function wsUrlSameOrigin() {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${location.host}/ws`;
}

declare const __SERVER_PORT__: number;
function wsUrlDirect() {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  const port = typeof __SERVER_PORT__ !== "undefined" ? __SERVER_PORT__ : 5174;
  return `${proto}://${location.hostname}:${port}/ws`;
}

type WsCtx = { subscribe: (handler: Handler) => () => void };
const WsContext = createContext<WsCtx | null>(null);

export function WsProvider({ children }: { children: React.ReactNode }) {
  const subscribers = useRef<Set<Handler>>(new Set());

  const subscribe = React.useCallback((handler: Handler) => {
    subscribers.current.add(handler);
    return () => { subscribers.current.delete(handler); };
  }, []);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let dead = false;

    const dispatch = (msg: WsMessage) => {
      for (const h of subscribers.current) h(msg);
    };

    const connect = (url: string, fallback?: () => void) => {
      if (dead) return;
      ws = new WebSocket(url);
      let settled = false;

      const failTimer = window.setTimeout(() => {
        if (!settled) { try { ws?.close(); } catch {} fallback?.(); }
      }, 800);

      ws.onopen = () => { settled = true; window.clearTimeout(failTimer); };
      ws.onmessage = (ev) => {
        try { dispatch(JSON.parse(ev.data) as WsMessage); } catch {}
      };
      ws.onerror = () => {
        if (!settled) { window.clearTimeout(failTimer); try { ws?.close(); } catch {} fallback?.(); }
      };
      ws.onclose = () => {
        window.clearTimeout(failTimer);
        if (!dead) window.setTimeout(() => { if (!dead) connect(url, fallback); }, 3000);
      };
    };

    connect(wsUrlSameOrigin(), () => connect(wsUrlDirect()));
    return () => { dead = true; try { ws?.close(); } catch {}; };
  }, []);

  const ctx = React.useMemo(() => ({ subscribe }), [subscribe]);
  return <WsContext.Provider value={ctx}>{children}</WsContext.Provider>;
}

export function useWs(onMessage: Handler) {
  const ctx = useContext(WsContext);
  if (!ctx) throw new Error("<WsProvider> is missing from the tree.");
  const handlerRef = useRef(onMessage);
  useEffect(() => { handlerRef.current = onMessage; }, [onMessage]);
  useEffect(() => {
    const forwarder: Handler = (msg) => handlerRef.current(msg);
    return ctx.subscribe(forwarder);
  }, [ctx]);
}
