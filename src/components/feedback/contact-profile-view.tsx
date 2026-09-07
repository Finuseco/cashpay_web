'use client';

import type { User as UserType } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  ArrowLeft,
  Video,
  Phone,
  MoreVertical,
  Bell,
  MessageSquare,
  Briefcase,
  Mail,
  Calendar,
  UserCheck,
  Wallet,
  Info,
  Globe,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import Image from 'next/image';
import { getCountryByCode } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

interface ContactProfileViewProps {
  user: UserType;
  onBack: () => void;
  onStartCall: (type: 'audio' | 'video') => void;
}

const InfoRow = ({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ElementType;
}) => (
  <div className="flex items-start gap-4 p-4">
    <Icon className="mt-1 h-5 w-5 shrink-0 text-zinc-400" />

    <div className="min-w-0">
      <p className="break-words text-sm text-white">{value}</p>
      <p className="text-xs text-zinc-400">{label}</p>
    </div>
  </div>
);

export function ContactProfileView({
  user,
  onBack,
  onStartCall,
}: ContactProfileViewProps) {
  const { t } = useTranslation();

  const countryInfo = user.country
    ? getCountryByCode(user.country)
    : null;

  const userHandle = `@${user.full_name
    .toLowerCase()
    .replace(/\s/g, '')}`;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#0b141a] text-white">
      {/* Header fixe */}
      <header className="z-10 flex shrink-0 items-center bg-[#1f2c33] p-2 sm:p-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft />
        </Button>

        <h2 className="ml-4 text-lg font-semibold">
          {t('profileTitle', 'Profil')}
        </h2>

        <div className="ml-auto">
          <Button variant="ghost" size="icon">
            <MoreVertical />
          </Button>
        </div>
      </header>

      {/* 
        Zone de contenu scrollable.
        min-h-0 est important dans une structure flex.
      */}
      <main
        className="
          min-h-0
          flex-1
          overflow-y-auto
          overscroll-contain
          touch-pan-y
          scrollbar-thin
        "
      >
        {/* Cover */}
        <div className="relative h-40 shrink-0 bg-zinc-800">
          {user.cover_photo && (
            <Image
              src={user.cover_photo}
              alt={`${user.full_name}'s cover photo`}
              fill
              className="object-cover opacity-50"
              data-ai-hint="abstract background"
            />
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-[#0d152b] to-transparent" />
        </div>

        {/* Profile Info */}
        <div className="space-y-4 p-4">
          <div className="-mt-16 flex items-end">
            <Avatar className="h-24 w-24 border-4 border-[#0d152b]">
              <AvatarImage
                src={user.profile_photo || ''}
                alt={user.full_name}
              />

              <AvatarFallback>
                {user.first_name?.[0]}
              </AvatarFallback>
            </Avatar>
          </div>

          <div className="flex min-w-0 items-center gap-2">
            <h1 className="min-w-0 break-words text-2xl font-bold">
              {user.full_name}
            </h1>

            {user.verification_status === 'blue' && (
              <Image
                src="/images/badge/badge-bleu.png"
                alt={t('verifiedBadge')}
                width={24}
                height={24}
                className="h-6 w-6 shrink-0"
              />
            )}

            {user.verification_status === 'red' && (
              <Image
                src="/images/badge/rouge.gif"
                alt={t('restrictedBadge')}
                width={24}
                height={24}
                className="h-6 w-6 shrink-0"
              />
            )}
          </div>

          <p className="-mt-2 break-words text-sm text-zinc-400">
            {userHandle} •{' '}
            {user.availabilityStatus === 'available'
              ? t('chatOnline')
              : t('chatOffline')}
          </p>

          {user.activity_description && (
            <p className="break-words text-sm text-zinc-300">
              {user.activity_description}
            </p>
          )}

          {/* Actions */}
          <div className="grid grid-cols-3 gap-2 pt-2">
            <Button
              variant="outline"
              className="border-zinc-700 bg-zinc-800 hover:bg-zinc-700"
              onClick={() => {}}
            >
              <MessageSquare className="mr-2 h-4 w-4" />
              Message
            </Button>

            <Button
              variant="outline"
              className="border-zinc-700 bg-zinc-800 hover:bg-zinc-700"
              onClick={() => onStartCall('audio')}
            >
              <Phone className="mr-2 h-4 w-4" />
              Appel
            </Button>

            <Button
              variant="outline"
              className="border-zinc-700 bg-zinc-800 hover:bg-zinc-700"
              onClick={() => onStartCall('video')}
            >
              <Video className="mr-2 h-4 w-4" />
              Vidéo
            </Button>
          </div>
        </div>

        {/* Informations */}
        <div className="p-4">
          <div className="rounded-lg bg-[#1f2c33] divide-y divide-zinc-700/50">
            <InfoRow
              label="Info"
              value={t('contactProfileInfo')}
              icon={Info}
            />

            {user.phone && (
              <InfoRow
                label={t('profilePhoneLabel')}
                value={user.phone}
                icon={Phone}
              />
            )}

            {user.email && (
              <InfoRow
                label={t('profileEmailLabel')}
                value={user.email}
                icon={Mail}
              />
            )}

            {user.id_wallet && (
              <InfoRow
                label={t('profileIdWalletLabel')}
                value={user.id_wallet}
                icon={Wallet}
              />
            )}

            {user.profession && (
              <InfoRow
                label={t('profileProfessionLabel')}
                value={user.profession}
                icon={Briefcase}
              />
            )}

            {user.birth_date && (
              <InfoRow
                label={t('profileDobLabel')}
                value={format(
                  new Date(user.birth_date),
                  'd MMMM yyyy',
                  { locale: fr }
                )}
                icon={Calendar}
              />
            )}

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

            {user.representative && (
              <InfoRow
                label={t('emergencyContactTitle')}
                value={`${user.representative.name} (${user.representative.contact})`}
                icon={UserCheck}
              />
            )}
          </div>
        </div>

        {/* Notifications */}
        <div className="p-4 pb-8">
          <div className="flex items-center justify-between rounded-lg bg-[#1f2c33] p-4">
            <div className="flex min-w-0 items-start gap-4">
              <Bell className="mt-1 h-5 w-5 shrink-0 text-zinc-400" />

              <div className="min-w-0">
                <p className="text-sm text-white">
                  {t('contactProfileNotifications')}
                </p>

                <p className="text-xs text-zinc-400">
                  {t('contactProfileNotificationsLabel')}
                </p>
              </div>
            </div>

            <Switch defaultChecked={true} />
          </div>
        </div>
      </main>
    </div>
  );
        }
