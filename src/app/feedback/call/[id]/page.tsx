'use client';
import { useParams } from 'next/navigation';
import { DirectCallInterface } from '@/components/feedback/direct-call-interface';
export default function Page(){const params=useParams<{id:string}>();return <DirectCallInterface callId={String(params?.id || '')}/>;}
