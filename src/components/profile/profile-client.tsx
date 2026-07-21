
'use client';

import { useState, useEffect } from "react";
import Image from "next/image";
import { useTranslation } from "react-i18next";
import { Camera, Mail, Phone, MapPin, Briefcase, Calendar, Shield, Languages, Edit, User as UserIcon, Wallet, Home, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { User } from '@/lib/types';
import { Skeleton } from "../ui/skeleton";
import { getAuthenticatedUser, updateUser } from "@/lib/actions/user.actions";
import { saveBase64Image } from "@/lib/actions/helpers";
import { validateProfilePhoto } from "@/ai/flows/validate-profile-photo-flow";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { Separator } from "../ui/separator";

const InfoRow = ({ icon: Icon, label, value }: { icon: React.ElementType, label: string, value?: string | null }) => (
    <div className="flex items-start gap-4">
        <Icon className="h-5 w-5 text-muted-foreground mt-1" />
        <div>
            <p className="font-semibold text-foreground">{value || 'N/A'}</p>
            <p className="text-sm text-muted-foreground">{label}</p>
        </div>
    </div>
);


export function ProfileClient() {
    const [user, setUser] = useState<User | null>(null);
    const [isClient, setIsClient] = useState(false);
    const { t } = useTranslation();
    const { openAlert } = useAlertDialog();

    useEffect(() => {
        setIsClient(true);
        const fetchUser = async () => {
            const fetchedUser = await getAuthenticatedUser();
            setUser(fetchedUser);
        };
        fetchUser();
    }, []);

    if (!user) {
        return (
            <div className="w-full">
                <Skeleton className="h-48 md:h-64 w-full" />
                <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="-mt-16 sm:-mt-20 flex items-end space-x-5">
                        <Skeleton className="h-24 w-24 sm:h-32 sm:w-32 rounded-full ring-4 ring-background" />
                    </div>
                </div>
            </div>
        );
    }

    const { full_name, profession, id_wallet, email, phone, address, city, country, birth_date, nationality, language } = user;

    return (
        <div className="w-full">
            {/* Cover and Profile Picture */}
            <div className="relative h-48 md:h-56 w-full">
                <Image 
                    src={user.cover_photo || "/covers/cover_patrick1.jpeg"} 
                    alt="Photo de couverture" 
                    fill
                    className="object-cover bg-muted" 
                />
                <div className="-mt-16 sm:-mt-20 absolute bottom-[-5rem] left-1/2 -translate-x-1/2">
                    <Avatar className="h-28 w-28 sm:h-32 sm:w-32 border-4 border-background shadow-lg">
                        <AvatarImage src={user.profile_photo || undefined} alt={full_name} />
                        <AvatarFallback>{user.first_name?.[0]}{user.last_name?.[0]}</AvatarFallback>
                    </Avatar>
                </div>
            </div>
            
            {/* Name and Title */}
            <div className="text-center pt-24 pb-8">
                <h1 className="text-3xl font-bold text-foreground">{full_name}</h1>
                <p className="text-muted-foreground mt-1">{profession}</p>
            </div>

            {/* Profile Content */}
            <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>{isClient ? t('profileContactTitle') : 'Contact Information'}</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <InfoRow icon={Wallet} label={isClient ? t('profileIdWalletLabel') : 'Wallet ID'} value={id_wallet} />
                        <InfoRow icon={Phone} label={isClient ? t('profilePhoneLabel') : 'Phone'} value={phone} />
                        <InfoRow icon={Mail} label={isClient ? t('profileEmailLabel') : 'Email'} value={email} />
                        <InfoRow icon={Home} label={isClient ? t('profileAddressLabel') : 'Address'} value={`${address}, ${city}, ${country}`} />
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>{isClient ? t('profilePersonalInfoTitle') : 'Personal Information'}</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <InfoRow icon={UserIcon} label={isClient ? t('profileFullNameLabel') : 'Full Name'} value={full_name} />
                        <InfoRow icon={Briefcase} label={isClient ? t('profileProfessionLabel') : 'Profession'} value={profession} />
                        <InfoRow icon={Calendar} label={isClient ? t('profileDobLabel') : 'Date of Birth'} value={birth_date ? new Date(birth_date).toLocaleDateString('fr-FR') : 'N/A'} />
                        <InfoRow icon={Globe} label={isClient ? t('profileNationalityLabel') : 'Nationality'} value={nationality} />
                    </CardContent>
                </Card>
                
                 <Card>
                    <CardHeader>
                        <CardTitle>{isClient ? t('profilePreferencesTitle') : 'Preferences'}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <InfoRow icon={Languages} label={isClient ? t('profileLanguageLabel') : 'Language'} value={language === 'fr' ? 'Français' : 'English'} />
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
