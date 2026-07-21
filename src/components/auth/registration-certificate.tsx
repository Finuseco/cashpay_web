'use client';

import React, { useRef } from 'react';
import jsPDF from 'jspdf';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/logo';
import { Separator } from '@/components/ui/separator';
import type { User } from '@/lib/types';
import { Download, CheckCircle, Printer } from 'lucide-react';
import { useTranslation } from "react-i18next";
import { useRouter } from 'next/navigation';
import Image from 'next/image';

const CertificateLayout = ({ user, isPdf = false }: { user: User, isPdf?: boolean }) => {
    const { t } = useTranslation();
    return (
        <div className={`p-8 ${isPdf ? 'bg-white text-black' : 'bg-card text-card-foreground'}`}>
            <div className="text-center mb-6">
                {isPdf ? (
                    <img src="/logos/logo.png" alt="CashPay Logo" style={{ width: '8rem', margin: '0 auto' }} />
                ) : (
                    <Logo className="w-40 mx-auto" />
                )}
                <p className="text-sm text-gray-500 mt-2">{t('finusecoPartnership')}</p>
            </div>
            <h1 className="text-2xl font-bold text-center mb-6">{t('registrationCertificateTitle')}</h1>

            <div className="space-y-4 text-sm">
                <h2 className="font-bold text-lg border-b pb-1">{t('holderInformationTitle')}</h2>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                    <div><strong>{t('profileFullNameLabel')}:</strong> {user.full_name}</div>
                    <div><strong>{t('profileIdWalletLabel')}:</strong> <span className="font-mono">{user.id_wallet}</span></div>
                    <div><strong>{t('profileDobLabel')}:</strong> {user.birth_date ? new Date(user.birth_date).toLocaleDateString('fr-FR') : 'N/A'}</div>
                    <div><strong>{t('pobLabel')}:</strong> {user.birth_place}</div>
                    <div><strong>{t('nationalityLabel')}:</strong> {user.nationality}</div>
                    <div><strong>{t('addressLabel')}:</strong> {user.address}, {user.city}</div>
                    <div><strong>{t('phoneLabel')}:</strong> {user.phone}</div>
                    <div><strong>{t('emailLabel')}:</strong> {user.email}</div>
                </div>
            </div>

            <Separator className="my-6" />

            <div className="space-y-2 text-xs text-gray-600">
                <h2 className="font-bold text-sm text-black mb-2">{t('termsAndCommitmentsTitle')}</h2>
                <p dangerouslySetInnerHTML={{ __html: t('termsAndCommitmentsBody', { fullName: user.full_name }) }}></p>
                <p>{t('termsAndCommitmentsPrivacy')}</p>
            </div>
            
            <div className="mt-8 text-center text-xs text-gray-500">
                <p>{t('certificateDate', { date: new Date().toLocaleDateString('fr-FR') })}</p>
                <div className="mt-8 flex justify-between items-end">
                    <div className="text-left">
                        <p>{t('holderSignature')}</p>
                    </div>
                     <div className="w-1/3 text-center">
                        {user.signature_image && <Image src={user.signature_image} alt="Signature" width={100} height={50} className="mx-auto h-12 object-contain" />}
                        <p className="border-t-2 border-black font-bold pt-1"></p>
                    </div>
                </div>
            </div>
            
            <Separator className="my-6" />
            
            <div className="text-center text-xs text-gray-500">
                <p><strong>FINUSECO SARL</strong> - Kinshasa, RDC</p>
                <p>{t('callCenter')}: +243853868021</p>
            </div>
        </div>
    );
};


export function RegistrationCertificate({ user }: { user: User }) {
    const { t } = useTranslation();
    const router = useRouter();
    const pdfRef = React.useRef<HTMLDivElement>(null);

    const handleGeneratePdf = async () => {
        const element = pdfRef.current;
        if (!element) return;
        
        const html2canvas = (await import('html2canvas')).default;
    
        const canvas = await html2canvas(element, { scale: 2, useCORS: true, windowWidth: element.scrollWidth, windowHeight: element.scrollHeight });
        const imgData = canvas.toDataURL('image/png');
        
        const pdf = new jsPDF({
            orientation: 'p',
            unit: 'mm',
            format: 'a4'
        });
    
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const canvasWidth = canvas.width;
        const canvasHeight = canvas.height;
        const canvasAspectRatio = canvasWidth / canvasHeight;
        const pdfAspectRatio = pdfWidth / pdfHeight;
        
        let finalWidth, finalHeight;
        if (canvasAspectRatio > pdfAspectRatio) {
            finalWidth = pdfWidth;
            finalHeight = pdfWidth / canvasAspectRatio;
        } else {
            finalHeight = pdfHeight;
            finalWidth = pdfHeight * canvasAspectRatio;
        }

        const x = (pdfWidth - finalWidth) / 2;
        const y = 10; // 10mm margin from top

        pdf.addImage(imgData, 'PNG', x, y, finalWidth, finalHeight);
        pdf.save(`fiche-inscription-cashpay-${user.id_wallet}.pdf`);
    };

    return (
        <div className="p-4 flex flex-col items-center">
            {/* Hidden element for PDF generation */}
            <div className="hidden">
                <div ref={pdfRef} style={{ width: '210mm' }}>
                    <CertificateLayout user={user} isPdf={true} />
                </div>
            </div>

            <div className="text-center">
                <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4"/>
                <h1 className="text-2xl font-bold text-white">{t('registrationSuccessTitle')}</h1>
                <p className="text-white/80 mt-2">{t('registrationSuccessWelcome', { name: user.first_name })}</p>
            </div>
            
            <div className="my-8 w-full max-w-lg">
                 <div id="certificate-preview" className="rounded-lg overflow-hidden shadow-lg border-4 border-zinc-700">
                    <CertificateLayout user={user} />
                 </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 w-full max-w-lg">
                <Button onClick={handleGeneratePdf} variant="outline" className="w-full">
                    <Download className="mr-2 h-4 w-4"/> {t('downloadCertificateButton')}
                </Button>
                 <Button onClick={() => router.push('/dashboard')} className="w-full bg-primary hover:bg-primary/90">
                    {t('goToDashboardButton')}
                </Button>
            </div>
        </div>
    );
}
