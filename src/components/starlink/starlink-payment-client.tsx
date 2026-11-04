'use client';
import type {User} from '@/lib/types';
import {TvSubscriptionPage} from '@/components/tv-subscription/tv-subscription-page-client';
export function StarlinkPaymentClient({user,isPaymentEnabled=true}:{user:User|null;isPaymentEnabled?:boolean}){return isPaymentEnabled?<TvSubscriptionPage user={user} providerFilter="starlink"/>:<p>Le service Starlink n’est pas activé.</p>;}
