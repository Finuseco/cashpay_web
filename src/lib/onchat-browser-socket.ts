'use client';
/** A short-lived, WS-only ticket avoids exposing the long-lived HttpOnly session cookie. */
export async function openOnChatSocket(address:string):Promise<WebSocket>{
 const url=new URL(address,location.href);
 if(url.protocol!=='wss:' && !(url.protocol==='ws:'&&['localhost','127.0.0.1'].includes(url.hostname)))throw new Error('Une adresse WebSocket publique sécurisée est requise.');
 const response=await fetch('/api/v1/onchat/ws-ticket',{method:'POST',cache:'no-store'});
 const data=await response.json();if(!response.ok||!data.ticket)throw new Error(data.error || 'Session WebSocket indisponible.');
 url.searchParams.set('ticket',data.ticket);
 return new WebSocket(url);
}
