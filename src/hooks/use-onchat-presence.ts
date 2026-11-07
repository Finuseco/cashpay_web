'use client';
import {useEffect,useState} from 'react';
import {onChatOnlineUsers,subscribeOnChatRealtime} from '@/lib/onchat-browser-socket';
export function useOnChatPresence(walletId?:string|null,userId?:number){
 const key=walletId || (userId?String(userId):'');
 const [online,setOnline]=useState(false);
 useEffect(()=>{setOnline(onChatOnlineUsers().has(key));return subscribeOnChatRealtime(event=>{if(event.startsWith('presence.'))setOnline(onChatOnlineUsers().has(key));});},[key]);
 return online;
}
