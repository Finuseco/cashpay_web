
'use client';

import type { User as UserType } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ArrowLeft, Video, Phone, MoreVertical, Bell, MessageSquare, Briefcase, Mail, Calendar, UserCheck, Wallet, Info } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { Badge } from '../ui/badge';
import { getCountryByCode, formatKiloMega } from '@/lib/utils';
import { useTranslation } from "react-i18next";

interface ContactProfileViewProps {
  user: UserType;
  onBack: () => void;
  onStartCall: (type: 'audio' | 'video') => void;
}

const InfoRow = ({ label, value, icon, isAccent = false }: { label: string, value: React.ReactNode, icon?: React.ReactNode, isAccent?: boolean }) => (
    <div className="py-3">
        <div className="flex items-start gap-4">
            {icon && <div className="text-zinc-400 mt-1">{icon}</div>}
            <div>
                <p className={isAccent ? "text-blue-400" : "text-white"}>{value}</p>
                <p className="text-zinc-400 text-sm">{label}</p>
            </div>
        </div>
    </div>
);

export function ContactProfileView({ user, onBack, onStartCall }: ContactProfileViewProps) {
  const { t } = useTranslation();
  const countryInfo = user.country ? getCountryByCode(user.country) : null;
  const userHandle = `@${user.full_name.toLowerCase().replace(/\s/g, '')}`;

  return (
    <div className="flex flex-col h-full bg-[#0d152b] text-white overflow-y-auto">
      <div className="relative">
        <div className="relative h-40 bg-zinc-800">
           {user.cover_photo && (
               <Image 
                    src={user.cover_photo} 
                    alt={`${user.full_name}'s cover photo`} 
                    fill 
                    className="object-cover opacity-50"
                    data-ai-hint="abstract background"
                />
            )}
             <div className="absolute inset-0 bg-gradient-to-t from-[#0d152b] to-transparent"></div>
        </div>
        
        {/* Header */}
        <header className="absolute top-0 left-0 right-0 z-10 flex items-center p-2 sm:p-3 shrink-0 bg-transparent">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft />
          </Button>
          <div className="ml-auto flex items-center gap-1">
              <Button variant="ghost" size="icon" onClick={() => onStartCall('video')}><Video /></Button>
              <Button variant="ghost" size="icon" onClick={() => onStartCall('audio')}><Phone /></Button>
              <Button variant="ghost" size="icon"><MoreVertical /></Button>
          </div>
        </header>
        
        {/* Profile Info */}
        <div className="absolute top-24 left-4">
            <Avatar className="h-20 w-20 border-4 border-[#0d152b]">
                <AvatarImage src={user.profile_photo || ''} alt={user.full_name} />
                <AvatarFallback>{user.first_name?.[0]}</AvatarFallback>
            </Avatar>
        </div>
      </div>
      
      {/* Body */}
      <div className="flex-1 p-4 space-y-4 pt-12">
         <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">{user.full_name}</h1>
            {user.verification_status === 'blue' && (
                <Image src="/images/badge/badge-bleu.png" alt={t('verifiedBadge')} width={24} height={24} className="h-6 w-6"/>
            )}
            {user.verification_status === 'red' && (
                <Image src="/images/badge/rouge.gif" alt={t('restrictedBadge')} width={24} height={24} className="h-6 w-6"/>
            )}
        </div>
        <p className="text-sm text-zinc-400 -mt-2">{userHandle} • {user.availabilityStatus === 'available' ? t('chatOnline') : t('chatOffline')}</p>

        <div className="bg-[#1f2c33] p-4 rounded-lg">
          <h3 className="text-blue-400 font-semibold mb-2">{t('contactProfileInfo')}</h3>
          <InfoRow label={t('profilePhoneLabel')} value={user.phone || t('notAvailable')} icon={<Phone className="h-5 w-5"/>} />
          {user.email && <div className="border-t border-zinc-700/50 my-1" />}
          {user.email && <InfoRow label={t('profileEmailLabel')} value={user.email} icon={<Mail className="h-5 w-5"/>} />}
          {user.activity_description && <div className="border-t border-zinc-700/50 my-1" />}
          {user.activity_description && <InfoRow label={t('contactProfileBio')} value={user.activity_description} icon={<Info className="h-5 w-5"/>} />}
          <div className="border-t border-zinc-700/50 my-1" />
          <InfoRow label={t('profileIdWalletLabel')} value={user.id_wallet} icon={<Wallet className="h-5 w-5"/>} />
          {user.profession && <div className="border-t border-zinc-700/50 my-1" />}
          {user.profession && <InfoRow label={t('profileProfessionLabel')} value={user.profession} icon={<Briefcase className="h-5 w-5"/>} />}
          {user.birth_date && <div className="border-t border-zinc-700/50 my-1" />}
          {user.birth_date && <InfoRow label={t('profileDobLabel')} value={format(new Date(user.birth_date), 'd MMMM yyyy', { locale: fr })} icon={<Calendar className="h-5 w-5"/>}/>}
          {countryInfo && <div className="border-t border-zinc-700/50 my-1" />}
          {countryInfo && (
              <InfoRow
                label={t('countryLabel')}
                value={
                  <div className="flex items-center gap-2">
                    <Image
                      src={`https://flagcdn.com/w20/${countryInfo.code.toLowerCase()}.png`}
                      alt={countryInfo.name}
                      width={20}
                      height={15}
                    />
                    <span>{countryInfo.name}</span>
                  </div>
                }
              />
            )}
          {user.representative && <div className="border-t border-zinc-700/50 my-1" />}
          {user.representative && <InfoRow label={t('emergencyContactTitle')} value={`${user.representative.name} (${user.representative.contact})`} icon={<UserCheck className="h-5 w-5"/>} />}
        </div>
        
        <div className="bg-[#1f2c33] p-4 rounded-lg flex items-center justify-between">
          <InfoRow label={t('contactProfileNotificationsLabel')} value={t('contactProfileNotifications')} icon={<Bell className="h-5 w-5"/>}/>
          <Switch defaultChecked={true} />
        </div>
      </div>
    </div>
  );
}
