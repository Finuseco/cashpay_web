'use client';

import { ChangeEvent, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import {
  BadgeCheck,
  BriefcaseBusiness,
  CalendarDays,
  Camera,
  ChevronRight,
  Globe2,
  Home,
  Languages,
  Mail,
  MapPin,
  MessageCircle,
  Pencil,
  Phone,
  ShieldCheck,
  UserRound,
  Wallet,
  X,
  Youtube,
  Instagram,
  Facebook,
  CircleDollarSign,
  Activity,
  CreditCard,
  Sparkles,
  ImagePlus,
  Loader2,
} from 'lucide-react';

import { useTranslation } from 'react-i18next';
import type { User } from '@/lib/types';
import { getAuthenticatedUser, updateUser } from '@/lib/actions/user.actions';
import { getUserAstroProfile, type AstroProfile } from '@/lib/actions/astro.actions';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

type ProfileTab = 'overview' | 'activity' | 'wallet' | 'about';

const formatBirthDate = (value?: string | null) => {
  if (!value) return 'N/A';

  const datePart = value.slice(0, 10);
  const [year, month, day] = datePart.split('-');

  if (!year || !month || !day) return value;

  return `${day}/${month}/${year}`;
};

const formatDate = (value?: string | null) => {
  if (!value) return 'N/A';

  try {
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(new Date(value));
  } catch {
    return value;
  }
};

const getInitials = (user: User) => {
  const first = user.first_name?.[0] || '';
  const last = user.last_name?.[0] || '';

  if (first || last) {
    return `${first}${last}`.toUpperCase();
  }

  return user.full_name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
};

const verificationLabel = (status?: User['verification_status']) => {
  if (status === 'blue') return 'Compte vérifié';
  if (status === 'green') return 'Compte vérifié';
  if (status === 'red') return 'Vérification en cours';

  return null;
};

const verificationClass = (status?: User['verification_status']) => {
  if (status === 'green') {
    return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400';
  }

  if (status === 'red') {
    return 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400';
  }

  return 'border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400';
};

const InfoItem = ({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value?: string | null;
}) => (
  <div className="flex min-w-0 items-start gap-3">
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted">
      <Icon className="h-4.5 w-4.5 text-muted-foreground" />
    </div>
    <div className="min-w-0">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 truncate text-sm font-semibold text-foreground">
        {value || 'N/A'}
      </p>
    </div>
  </div>
);

export function ProfileClient() {
  const [user, setUser] = useState<User | null>(null);
  const [astro, setAstro] = useState<AstroProfile | null>(null);
  const [activeTab, setActiveTab] = useState<ProfileTab>('overview');
  const [isClient, setIsClient] = useState(false);
  const [isUploading, setIsUploading] = useState<'avatar' | 'cover' | null>(null);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const { t } = useTranslation();

  useEffect(() => {
    setIsClient(true);

    const loadProfile = async () => {
      const fetchedUser = await getAuthenticatedUser();

      if (!fetchedUser) {
        setUser(null);
        return;
      }

      setUser(fetchedUser);

      try {
        const astroProfile = await getUserAstroProfile(fetchedUser.id);
        setAstro(astroProfile);
      } catch {
        setAstro(null);
      }
    };

    loadProfile();
  }, []);

  const handleImageChange = async (
    event: ChangeEvent<HTMLInputElement>,
    type: 'avatar' | 'cover'
  ) => {
    const file = event.target.files?.[0];

    if (!file || !user) return;

    if (!file.type.startsWith('image/')) {
      event.target.value = '';
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      event.target.value = '';
      return;
    }

    setIsUploading(type);

    try {
      const reader = new FileReader();

      reader.onload = async () => {
        try {
          const base64 = String(reader.result || '');

          const result = await updateUser({
            userId: user.id,
            updates:
              type === 'avatar'
                ? { profile_photo: base64 }
                : { cover_photo: base64 },
          });

          if (result.success && result.user) {
            setUser(result.user);
          }
        } finally {
          setIsUploading(null);
          event.target.value = '';
        }
      };

      reader.onerror = () => {
        setIsUploading(null);
        event.target.value = '';
      };

      reader.readAsDataURL(file);
    } catch {
      setIsUploading(null);
      event.target.value = '';
    }
  };

  if (!user) {
    return (
      <div className="w-full">
        <div className="relative h-56 w-full overflow-hidden md:h-72">
          <Skeleton className="h-full w-full" />
        </div>

        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="-mt-16 flex items-end">
            <Skeleton className="h-32 w-32 rounded-full ring-4 ring-background sm:h-36 sm:w-36" />
          </div>

          <div className="space-y-3 pb-8 pt-6">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-24 w-full" />
          </div>
        </div>
      </div>
    );
  }

  const {
    full_name,
    profession,
    activity_description,
    id_wallet,
    email,
    phone,
    address,
    city,
    province,
    country,
    birth_date,
    nationality,
    language,
    role,
    status,
    account_type,
    verification_status,
    availabilityStatus,
    created_at,
    is_crypto_active,
  } = user;

  const location = [city, province, country].filter(Boolean).join(', ');

  const verificationText = verificationLabel(verification_status);

  const tabs: { id: ProfileTab; label: string; icon: React.ElementType }[] = [
    { id: 'overview', label: 'Vue d’ensemble', icon: UserRound },
    { id: 'activity', label: 'Activité', icon: Activity },
    { id: 'wallet', label: 'Portefeuille', icon: Wallet },
    { id: 'about', label: 'À propos', icon: Globe2 },
  ];

  return (
    <div className="w-full bg-background">
      {/* =========================================================
          PROFILE HERO
          Important: this section is contained inside the profile
          component and does not touch the application's top bar.
         ========================================================= */}
      <section className="relative">
        <div className="relative h-56 w-full overflow-hidden md:h-72">
          <Image
            src={user.cover_photo || '/covers/cover_patrick1.jpeg'}
            alt="Photo de couverture"
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />

          <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/10 to-black/70" />

          <div className="absolute bottom-4 right-4">
            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => handleImageChange(event, 'cover')}
            />

            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="border border-white/20 bg-black/40 text-white backdrop-blur-md hover:bg-black/60"
              disabled={isUploading === 'cover'}
              onClick={() => coverInputRef.current?.click()}
            >
              {isUploading === 'cover' ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ImagePlus className="mr-2 h-4 w-4" />
              )}
              Modifier la couverture
            </Button>
          </div>
        </div>

        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="relative -mt-16 flex flex-col gap-4 sm:-mt-20 sm:flex-row sm:items-end">
            <div className="relative z-10 shrink-0">
              <Avatar className="h-32 w-32 border-4 border-background bg-background shadow-2xl sm:h-36 sm:w-36">
                <AvatarImage
                  src={user.profile_photo || undefined}
                  alt={full_name}
                  className="object-cover"
                />
                <AvatarFallback className="bg-muted text-2xl font-bold">
                  {getInitials(user)}
                </AvatarFallback>
              </Avatar>

              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => handleImageChange(event, 'avatar')}
              />

              <button
                type="button"
                aria-label="Modifier la photo de profil"
                disabled={isUploading === 'avatar'}
                onClick={() => avatarInputRef.current?.click()}
                className="absolute bottom-1 right-1 flex h-10 w-10 items-center justify-center rounded-full border-4 border-background bg-primary text-primary-foreground shadow-lg transition hover:scale-105 disabled:opacity-60"
              >
                {isUploading === 'avatar' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Camera className="h-4 w-4" />
                )}
              </button>
            </div>

            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 pb-1 sm:pb-2">
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="h-10 w-10 rounded-full shadow-sm"
                aria-label="WhatsApp"
                title="WhatsApp"
              >
                <MessageCircle className="h-4 w-4" />
              </Button>

              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="h-10 w-10 rounded-full shadow-sm"
                aria-label="Facebook"
                title="Facebook"
              >
                <Facebook className="h-4 w-4" />
              </Button>

              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="h-10 w-10 rounded-full shadow-sm"
                aria-label="Instagram"
                title="Instagram"
              >
                <Instagram className="h-4 w-4" />
              </Button>

              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="h-10 w-10 rounded-full shadow-sm"
                aria-label="X"
                title="X"
              >
                <X className="h-4 w-4" />
              </Button>

              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="h-10 w-10 rounded-full shadow-sm"
                aria-label="YouTube"
                title="YouTube"
              >
                <Youtube className="h-4 w-4" />
              </Button>

              <div className="ml-auto flex gap-2">
                <Button type="button" variant="outline" size="sm">
                  <Pencil className="mr-2 h-4 w-4" />
                  Modifier
                </Button>
              </div>
            </div>
          </div>

          <div className="pb-6 pt-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                    {full_name}
                  </h1>

                  {verificationText && (
                    <Badge
                      variant="outline"
                      className={`gap-1 ${verificationClass(verification_status)}`}
                    >
                      <BadgeCheck className="h-4 w-4" />
                      {verificationText}
                    </Badge>
                  )}

                  {astro?.zodiac && (
                    <Badge
                      variant="outline"
                      className="gap-1 border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      {astro.zodiac.symbol} {astro.zodiac.nameFr}
                    </Badge>
                  )}
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
                  {profession && (
                    <span className="inline-flex items-center gap-1.5">
                      <BriefcaseBusiness className="h-4 w-4" />
                      {profession}
                    </span>
                  )}

                  {location && (
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="h-4 w-4" />
                      {location}
                    </span>
                  )}

                  {availabilityStatus && (
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className={`h-2 w-2 rounded-full ${
                          availabilityStatus === 'available'
                            ? 'bg-emerald-500'
                            : availabilityStatus === 'busy'
                              ? 'bg-red-500'
                              : availabilityStatus === 'away'
                                ? 'bg-amber-500'
                                : 'bg-muted-foreground'
                        }`}
                      />
                      {availabilityStatus === 'available'
                        ? 'Disponible'
                        : availabilityStatus === 'busy'
                          ? 'Occupé'
                          : availabilityStatus === 'away'
                            ? 'Absent'
                            : 'Hors ligne'}
                    </span>
                  )}
                </div>

                {activity_description && (
                  <p className="mt-4 max-w-3xl text-sm leading-6 text-muted-foreground">
                    {activity_description}
                  </p>
                )}
              </div>

              <div className="flex shrink-0 flex-wrap gap-2">
                <Button type="button">
                  <MessageCircle className="mr-2 h-4 w-4" />
                  Message
                </Button>
                <Button type="button" variant="outline">
                  Partager
                </Button>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto border-b">
            <div className="flex min-w-max gap-1">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;

                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`relative flex items-center gap-2 px-4 py-3 text-sm font-medium transition ${
                      active
                        ? 'text-primary'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}

                    {active && (
                      <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-primary" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        {activeTab === 'overview' && (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(300px,0.9fr)]">
            <div className="space-y-6">
              <Card className="overflow-hidden">
                <CardContent className="p-0">
                  <div className="border-b px-5 py-4 sm:px-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="font-semibold">Informations du profil</h2>
                        <p className="text-sm text-muted-foreground">
                          Votre identité et vos coordonnées CashPay.
                        </p>
                      </div>
                      <UserRound className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </div>

                  <div className="grid gap-6 p-5 sm:grid-cols-2 sm:p-6">
                    <InfoItem
                      icon={UserRound}
                      label={isClient ? t('profileFullNameLabel') : 'Nom complet'}
                      value={full_name}
                    />

                    <InfoItem
                      icon={BriefcaseBusiness}
                      label={isClient ? t('profileProfessionLabel') : 'Profession'}
                      value={profession}
                    />

                    <InfoItem
                      icon={Phone}
                      label={isClient ? t('profilePhoneLabel') : 'Téléphone'}
                      value={phone}
                    />

                    <InfoItem
                      icon={Mail}
                      label={isClient ? t('profileEmailLabel') : 'E-mail'}
                      value={email}
                    />

                    <InfoItem
                      icon={MapPin}
                      label="Localisation"
                      value={location}
                    />

                    <InfoItem
                      icon={Home}
                      label={isClient ? t('profileAddressLabel') : 'Adresse'}
                      value={address}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-5 sm:p-6">
                  <div className="mb-6 flex items-center justify-between">
                    <div>
                      <h2 className="font-semibold">Informations personnelles</h2>
                      <p className="text-sm text-muted-foreground">
                        Informations enregistrées sur votre compte.
                      </p>
                    </div>
                    <CalendarDays className="h-5 w-5 text-muted-foreground" />
                  </div>

                  <div className="grid gap-6 sm:grid-cols-2">
                    <InfoItem
                      icon={CalendarDays}
                      label={isClient ? t('profileDobLabel') : 'Date de naissance'}
                      value={formatBirthDate(birth_date)}
                    />

                    <InfoItem
                      icon={Globe2}
                      label={isClient ? t('profileNationalityLabel') : 'Nationalité'}
                      value={nationality}
                    />

                    <InfoItem
                      icon={Languages}
                      label={isClient ? t('profileLanguageLabel') : 'Langue'}
                      value={
                        language === 'fr'
                          ? 'Français'
                          : language === 'en'
                            ? 'English'
                            : language
                      }
                    />

                    <InfoItem
                      icon={BriefcaseBusiness}
                      label="Type de compte"
                      value={account_type}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card className="overflow-hidden border-primary/20">
                <div className="bg-gradient-to-br from-primary/10 via-background to-background p-5 sm:p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Identité financière
                      </p>
                      <h2 className="mt-1 text-xl font-bold">CashPay Wallet</h2>
                    </div>

                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10">
                      <Wallet className="h-5 w-5 text-primary" />
                    </div>
                  </div>

                  <div className="mt-6 rounded-2xl border bg-background/80 p-4">
                    <p className="text-xs text-muted-foreground">ID Wallet</p>
                    <p className="mt-1 break-all font-mono text-lg font-bold tracking-wide">
                      {id_wallet}
                    </p>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border bg-background/60 p-3">
                      <p className="text-xs text-muted-foreground">Compte</p>
                      <p className="mt-1 text-sm font-semibold">{account_type}</p>
                    </div>

                    <div className="rounded-2xl border bg-background/60 p-3">
                      <p className="text-xs text-muted-foreground">Statut</p>
                      <p className="mt-1 text-sm font-semibold">{status}</p>
                    </div>
                  </div>

                  {is_crypto_active && (
                    <div className="mt-4 flex items-center gap-2 rounded-xl border border-violet-500/20 bg-violet-500/5 px-3 py-2 text-sm">
                      <CircleDollarSign className="h-4 w-4 text-violet-600" />
                      <span>Services crypto activés</span>
                    </div>
                  )}

                  <Button
                    type="button"
                    variant="outline"
                    className="mt-5 w-full justify-between"
                  >
                    Ouvrir mon portefeuille
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </Card>

              {astro?.zodiac && (
                <Card>
                  <CardContent className="p-5">
                    <div className="flex items-center gap-4">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-violet-500/10 text-3xl">
                        {astro.zodiac.symbol}
                      </div>

                      <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Profil astrologique
                        </p>
                        <h3 className="mt-1 font-bold">
                          {astro.zodiac.nameFr}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {astro.zodiac.nameEn} · {formatBirthDate(astro.birthDate)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}

        {activeTab === 'activity' && (
          <Card>
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10">
                  <Activity className="h-5 w-5 text-primary" />
                </div>

                <div>
                  <h2 className="font-semibold">Activité</h2>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    Les activités et publications de votre profil pourront
                    apparaître ici sans modifier la structure de navigation
                    existante de CashPay All.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {activeTab === 'wallet' && (
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
                    <Wallet className="h-5 w-5 text-primary" />
                  </div>

                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Wallet ID
                    </p>
                    <p className="mt-1 font-mono font-bold">{id_wallet}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
                    <CreditCard className="h-5 w-5" />
                  </div>

                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Type de compte
                    </p>
                    <p className="mt-1 font-semibold">{account_type}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'about' && (
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardContent className="p-6">
                <h2 className="font-semibold">À propos</h2>

                {activity_description ? (
                  <p className="mt-3 text-sm leading-7 text-muted-foreground">
                    {activity_description}
                  </p>
                ) : (
                  <p className="mt-3 text-sm text-muted-foreground">
                    Aucune description professionnelle renseignée.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <h2 className="font-semibold">Informations du compte</h2>

                <div className="mt-5 space-y-4">
                  <InfoItem icon={ShieldCheck} label="Rôle" value={role} />
                  <InfoItem
                    icon={CalendarDays}
                    label="Membre depuis"
                    value={formatDate(created_at)}
                  />
                  <InfoItem
                    icon={Languages}
                    label="Langue"
                    value={language}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
