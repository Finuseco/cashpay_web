'use client';
import { useEffect, useState } from 'react';
type State = { status: string; participants: number };
const listeners = new Map<string, Set<(state: State) => void>>();
let socket: WebSocket | null = null;
let retry: ReturnType<typeof setTimeout> | null = null;
function connect() {
    if (!listeners.size || socket?.readyState === WebSocket.OPEN || socket?.readyState === WebSocket.CONNECTING) return;
    const url = process.env.NEXT_PUBLIC_ONCHAT_WS_URL || `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws`;
    const current = new WebSocket(url); socket = current;
    current.onopen = () => { for (const meetCode of listeners.keys()) current.send(JSON.stringify({ event: 'meet.watch', data: { meetCode } })); };
    current.onmessage = event => { try { const { event: name, data } = JSON.parse(event.data); if (name === 'meet.updated') listeners.get(data.meetCode)?.forEach(fn => fn(data)); } catch { /* Ignore malformed events. */ } };
    current.onclose = () => { if (socket === current) { socket = null; if (listeners.size) retry = setTimeout(connect, 3000); } };
    current.onerror = () => current.close();
}
export function useMeetingStatus(code: string) {
    const [state, setState] = useState<State>({ status: 'unknown', participants: 0 });
    useEffect(() => {
        let active = true;
        const update = (next: State) => { if (active) setState(next); };
        const subscribers = listeners.get(code) || new Set(); subscribers.add(update); listeners.set(code, subscribers);
        if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ event: 'meet.watch', data: { meetCode: code } }));
        connect();
        const refresh = async () => { try { const response = await fetch(`/api/v1/meetings/${encodeURIComponent(code)}/status`, { cache: 'no-store' }); const data = await response.json(); if (response.ok && data.success) update(data); } catch { /* Keep last confirmed state; retry on next interval. */ } };
        refresh(); const interval = setInterval(() => { if (socket?.readyState !== WebSocket.OPEN) refresh(); }, 15000);
        return () => {
            active = false; clearInterval(interval); subscribers.delete(update);
            if (!subscribers.size) { listeners.delete(code); if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ event: 'meet.unwatch', data: { meetCode: code } })); }
            if (!listeners.size) { if (retry) clearTimeout(retry); socket?.close(); socket = null; }
        };
    }, [code]);
    return state;
}
