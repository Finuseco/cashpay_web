
'use client';

import type { User as UserType } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ArrowLeft, Video, Phone, MoreVertical, Bell, MessageSquare, Briefcase, Mail, Calendar, UserCheck, Wallet, Info, Globe } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { Badge } from '../ui/badge';
import { getCountryByCode, formatKiloMega } from '@/lib/utils';
import { useTranslation } from "react-i18next";
import { Separator } from '../ui/separator';

interface ContactProfileViewProps {
  user: UserType;
  onBack: () => void;
  onStartCall: (type: 'audio' | 'video') => void;
}

const InfoRow = ({ label, value, icon: Icon }: { label: string, value: React.ReactNode, icon: React.ElementType }) => (
    <div className="flex items-start gap-4 p-4">
        <Icon className="h-5 w-5 text-zinc-400 mt-1" />
        <div>
            <p className="text-white text-sm">{value}</p>
            <p className="text-zinc-400 text-xs">{label}</p>
        </div>
    </div>
);

export function ContactProfileView({ user, onBack, onStartCall }: ContactProfileViewProps) {
  const { t } = useTranslation();
  const countryInfo = user.country ? getCountryByCode(user.country) : null;
  const userHandle = `@${user.full_name.toLowerCase().replace(/\s/g, '')}`;

  return (
    <div className="flex flex-col h-full bg-[#0b141a] text-white">
        {/* Header */}
        <header className="sticky top-0 z-10 flex items-center p-2 sm:p-3 shrink-0 bg-[#1f2c33]">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft />
          </Button>
          <h2 className="font-semibold text-lg ml-4">{t('profileTitle', 'Profil')}</h2>
          <div className="ml-auto">
             <Button variant="ghost" size="icon"><MoreVertical /></Button>
          </div>
        </header>

      <main className="flex-1 overflow-y-auto">
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
        
        {/* Profile Info */}
        <div className="p-4 space-y-4">
            <div className="flex items-end -mt-16">
                <Avatar className="h-24 w-24 border-4 border-[#0d152b]">
                    <AvatarImage src={user.profile_photo || ''} alt={user.full_name} />
                    <AvatarFallback>{user.first_name?.[0]}</AvatarFallback>
                </Avatar>
            </div>
            
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
            {user.activity_description && <p className="text-zinc-300 text-sm">{user.activity_description}</p>}

            <div className="grid grid-cols-3 gap-2 pt-2">
                <Button variant="outline" className="bg-zinc-800 border-zinc-700 hover:bg-zinc-700" onClick={() => {}}><MessageSquare className="mr-2 h-4 w-4"/>Message</Button>
                <Button variant="outline" className="bg-zinc-800 border-zinc-700 hover:bg-zinc-700" onClick={() => onStartCall('audio')}><Phone className="mr-2 h-4 w-4"/>Appel</Button>
                <Button variant="outline" className="bg-zinc-800 border-zinc-700 hover:bg-zinc-700" onClick={() => onStartCall('video')}><Video className="mr-2 h-4 w-4"/>Vidéo</Button>
            </div>
        </div>

        <div className="p-4">
             <div className="bg-[#1f2c33] rounded-lg divide-y divide-zinc-700/50">
                 <InfoRow label="Info" value={t('contactProfileInfo')} icon={Info} />
                 {user.phone && <InfoRow label={t('profilePhoneLabel')} value={user.phone} icon={Phone}/>}
                 {user.email && <div className="border-t border-zinc-700/50 my-1" />}
                 {user.email && <InfoRow label={t('profileEmailLabel')} value={user.email} icon={Mail}/>}
                 {user.id_wallet && <div className="border-t border-zinc-700/50 my-1" />}
                 {user.id_wallet && <InfoRow label={t('profileIdWalletLabel')} value={user.id_wallet} icon={Wallet}/>}
                 {user.profession && <div className="border-t border-zinc-700/50 my-1" />}
                 {user.profession && <InfoRow label={t('profileProfessionLabel')} value={user.profession} icon={Briefcase}/>}
                 {user.birth_date && <div className="border-t border-zinc-700/50 my-1" />}
                 {user.birth_date && <InfoRow label={t('profileDobLabel')} value={format(new Date(user.birth_date), 'd MMMM yyyy', { locale: fr })} icon={Calendar}/>}
                 {countryInfo && <div className="border-t border-zinc-700/50 my-1" />}
                 {countryInfo && (
              <InfoRow
                icon={Globe}
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
                 {user.representative && <InfoRow label={t('emergencyContactTitle')} value={`${user.representative.name} (${user.representative.contact})`} icon={UserCheck}/>}
             </div>
        </div>
        
        <div className="p-4">
            <div className="bg-[#1f2c33] p-4 rounded-lg flex items-center justify-between">
              <div className="flex items-start gap-4">
                <Bell className="h-5 w-5 text-zinc-400 mt-1" />
                <div>
                    <p className="text-white text-sm">{t('contactProfileNotifications')}</p>
                    <p className="text-zinc-400 text-xs">{t('contactProfileNotificationsLabel')}</p>
                </div>
            </div>
              <Switch defaultChecked={true} />
            </div>
        </div>
      </main>
    </div>
  );
}
