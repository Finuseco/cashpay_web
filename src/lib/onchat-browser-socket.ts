'use client';
/** A short-lived, WS-only ticket avoids exposing the long-lived HttpOnly session cookie. */
export async function openOnChatSocket(address:string):Promise<WebSocket>{
 const url=new URL(address,location.href);
 if(url.protocol!=='wss:' && !(url.protocol==='ws:'&&['localhost','127.0.0.1'].includes(url.hostname)))throw new Error('Une adresse WebSocket publique sécurisée est requise.');
 const response=await fetch('/api/v1/onchat/ws-ticket',{method:'POST',cache:'no-store',signal:AbortSignal.timeout(15000)});
 const data=await response.json();if(!response.ok||!data.ticket)throw new Error(data.error || 'Session WebSocket indisponible.');
 url.searchParams.set('ticket',data.ticket);
 return new WebSocket(url);
}

/** Register after installing message handlers; also covers a handshake that already completed. */
export function whenOnChatSocketOpen(socket: WebSocket, ready: () => void) {
 if (socket.readyState === WebSocket.OPEN) ready();
 else if (socket.readyState === WebSocket.CONNECTING) socket.addEventListener('open', ready, { once: true });
}
export function onChatSocketAddress(): string {
 return process.env.NEXT_PUBLIC_ONCHAT_WS_URL || 'wss://app.cashpay-all.com/ws';
}

const realtimeListeners = new Set<(event: string, data: any) => void>();
let realtimeSocket: WebSocket | null = null;
let connecting = false;
let retry: ReturnType<typeof setTimeout> | undefined;
const onlineUsers=new Set<string>();
export function onChatOnlineUsers(){return new Set(onlineUsers);}
function dispatchRealtime(event:string,data:any){
 if(event==='presence.snapshot'){onlineUsers.clear();for(const user of data?.users||[]){if(user.userId!=null)onlineUsers.add(String(user.userId));if(user.walletId)onlineUsers.add(String(user.walletId));}}
 if(event==='presence.online'||event==='presence.offline'){for(const key of [data?.userId,data?.walletId])if(key!=null){if(event==='presence.online')onlineUsers.add(String(key));else onlineUsers.delete(String(key));}}
 realtimeListeners.forEach(listener=>listener(event==='realtime.resync'?'reconnected':event,data));
}
function connectRealtime() {
 if (connecting || realtimeSocket || !realtimeListeners.size) return;
 connecting = true;
 void openOnChatSocket(onChatSocketAddress()).then(socket => {
  connecting = false;
  if (!realtimeListeners.size) { socket.close(); return; }
  realtimeSocket = socket;
  const deadline = setTimeout(() => socket.close(), 15000);
  socket.onmessage = message => {
   try { const {event, data} = JSON.parse(message.data); dispatchRealtime(event,data); } catch { /* A malformed frame cannot replace database history. */ }
  };
  socket.onclose = () => { clearTimeout(deadline); dispatchRealtime('presence.snapshot',{users:[]}); if (realtimeSocket === socket) realtimeSocket = null; if (realtimeListeners.size) retry = setTimeout(connectRealtime, 3000); };
  socket.onerror = () => socket.close();
  whenOnChatSocketOpen(socket, () => { clearTimeout(deadline); realtimeListeners.forEach(listener => listener('reconnected', {})); });
 }).catch(() => { connecting = false; if (realtimeListeners.size) retry = setTimeout(connectRealtime, 3000); });
}
/** Events invalidate local state; callers reload authorized messages from PostgreSQL through the API. */
export function subscribeOnChatRealtime(listener: (event: string, data: any) => void) {
 realtimeListeners.add(listener); connectRealtime();
 return () => { realtimeListeners.delete(listener); if (!realtimeListeners.size) { clearTimeout(retry); realtimeSocket?.close(); realtimeSocket = null; } };
}
