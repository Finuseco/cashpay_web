
'use client';

import { useTranslation } from "react-i18next";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export default function FaqPage() {
    const { t } = useTranslation();

    const faqs = [
        {
            question: "Qu'est-ce que CashPay ?",
            answer: "CashPay est une solution financière numérique qui vous permet de gérer votre argent, d'effectuer des paiements, des transferts, d'acheter du crédit, de payer des abonnements et bien plus encore, le tout depuis votre téléphone."
        },
        {
            question: "Comment puis-je déposer de l'argent sur mon compte ?",
            answer: "Vous pouvez déposer de l'argent via les services de Mobile Money (M-Pesa, Orange Money, etc.), par carte bancaire (Visa, Mastercard) ou en vous rendant dans une agence CashPay agréée."
        },
        {
            question: "Comment fonctionne le transfert d'argent (national et international) ?",
            answer: "Pour un transfert national, allez dans la section 'Envoyer', choisissez 'Transfert National', entrez l'ID du portefeuille du destinataire et le montant. Pour l'international, sélectionnez 'Transfert International', choisissez le pays de destination et la devise. L'application calculera les frais et le montant final pour le destinataire."
        },
        {
            question: "Comment recevoir de l'argent de l'étranger (Western Union, MoneyGram) ?",
            answer: "Allez dans la section 'International', choisissez le service (ex: Western Union), entrez le numéro de suivi (MTCN) et les informations de l'expéditeur. Après vérification, les fonds seront crédités sur votre portefeuille CashPay."
        },
        {
            question: "Puis-je utiliser ma carte virtuelle CashPay partout ?",
            answer: "Oui, votre carte virtuelle (Visa ou Mastercard) fonctionne sur tous les sites et plateformes en ligne qui acceptent ces cartes, que ce soit pour des achats nationaux ou internationaux. Elle est idéale pour les achats en ligne, les abonnements et les voyages."
        },
        {
            question: "Qu'est-ce que le bureau de change (Exchange) ?",
            answer: "Le bureau de change vous permet de convertir instantanément de l'argent entre vos différents portefeuilles (USD, EUR, CDF) au taux du jour, directement dans l'application."
        },
        {
            question: "Comment obtenir un relevé bancaire ?",
            answer: "Vous pouvez demander un relevé bancaire pour une période donnée depuis la section 'Relevés bancaires' du menu. Ce service est payant et les frais seront indiqués avant de confirmer votre demande."
        },
        {
            question: "Mes informations sont-elles en sécurité ?",
            answer: "Absolument. Nous utilisons des technologies de cryptage avancées et des mesures de sécurité robustes, y compris la vérification par OTP et PIN, pour protéger votre compte et vos informations personnelles."
        }
    ];

    return (
        <DashboardLayout>
            <main className="flex-1 p-4 md:p-8">
                <div className="max-w-4xl mx-auto">
                    <div className="text-center mb-8">
                        <h1 className="text-3xl font-bold text-foreground">Questions Fréquemment Posées (FAQ)</h1>
                        <p className="mt-2 text-lg text-muted-foreground">Trouvez des réponses à vos questions.</p>
                    </div>

                    <Card>
                        <CardContent className="p-6">
                            <Accordion type="single" collapsible className="w-full">
                                {faqs.map((faq, index) => (
                                    <AccordionItem value={`item-${index}`} key={index}>
                                        <AccordionTrigger>{faq.question}</AccordionTrigger>
                                        <AccordionContent>
                                            {faq.answer}
                                        </AccordionContent>
                                    </AccordionItem>
                                ))}
                            </Accordion>
                        </CardContent>
                    </Card>
                </div>
            </main>
        </DashboardLayout>
    );
}
