'use client';
import type {User} from '@/lib/types';
import {TvSubscriptionPage} from '@/components/tv-subscription/tv-subscription-page-client';
export function StarlinkPaymentClient({user}:{user:User|null}){return <TvSubscriptionPage user={user} providerFilter="starlink"/>;}
