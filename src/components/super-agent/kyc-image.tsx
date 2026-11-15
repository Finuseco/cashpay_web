'use client';
import {useEffect,useState} from 'react';
/** Native authenticated image requests preserve the session cookie; the optimizer does not. */
export function KycImage({src,label}:{src?:string;label:string}){
 const [failed,setFailed]=useState(false);useEffect(()=>setFailed(false),[src]);
 const missing=!src||/\/id_placeholder\.jpg(?:\?|$)/i.test(src);
 return missing||failed?<div role="status" className="h-full flex items-center justify-center text-center p-3 text-sm text-zinc-500">{label} indisponible. Vérifiez le document enregistré.</div>:<img src={src} alt={label} className="w-full h-full object-contain" referrerPolicy="same-origin" onError={()=>setFailed(true)}/>;
}
