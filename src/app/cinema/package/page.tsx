import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Crown, Check } from 'lucide-react';

const packages = [
    { name: "Mobile", price: "3.99", features: ["1 écran", "Qualité Standard", "Téléphone & Tablette"] },
    { name: "Standard", price: "7.99", features: ["2 écrans", "Full HD (1080p)", "Tous les appareils"] },
    { name: "Premium", price: "11.99", features: ["4 écrans", "Ultra HD (4K)", "Tous les appareils"] },
];

export default function PackagePage() {
    return (
        <div className="p-4 md:p-8">
            <h1 className="text-3xl font-bold text-white mb-2 text-center">Choisissez votre forfait</h1>
            <p className="text-zinc-400 text-center mb-8">Passez à un forfait supérieur pour profiter de plus de fonctionnalités.</p>
            <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
                {packages.map(pkg => (
                    <Card key={pkg.name} className="bg-zinc-800 border-red-600/50 text-white flex flex-col">
                        <CardHeader>
                            <CardTitle className="text-red-500">{pkg.name}</CardTitle>
                            <p className="text-3xl font-bold">${pkg.price}<span className="text-base font-normal text-zinc-400">/mois</span></p>
                        </CardHeader>
                        <CardContent className="flex-1 space-y-3">
                            {pkg.features.map(feat => (
                                <div key={feat} className="flex items-center gap-2">
                                    <Check className="h-4 w-4 text-green-500" />
                                    <span>{feat}</span>
                                </div>
                            ))}
                        </CardContent>
                        <div className="p-6 pt-0">
                            <Button className="w-full bg-red-600 hover:bg-red-700">Choisir ce forfait</Button>
                        </div>
                    </Card>
                ))}
            </div>
        </div>
    );
}
