
'use client';

import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { BrainCircuit } from "lucide-react";

const GameCard = ({ name, imageUrl, onClick, dataAiHint }: { name: string; imageUrl: string; onClick: () => void; dataAiHint?: string }) => {
  const { t } = useTranslation();
  return (
    <div className="group relative rounded-lg overflow-hidden cursor-pointer h-80 w-full max-w-sm" onClick={onClick}>
      <Image
        src={imageUrl}
        alt={name}
        width={400}
        height={500}
        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
        data-ai-hint={dataAiHint}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
      <div className="absolute inset-0 flex flex-col justify-end p-6">
        <h3 className="text-white font-bold text-2xl">{name}</h3>
      </div>
      <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <Button variant="default" className="bg-yellow-400 text-black hover:bg-yellow-500 font-bold h-12 px-8 text-lg">{t('casinoPlayButton')}</Button>
      </div>
    </div>
  );
};


export function CasinoClient() {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <main className="flex-1 p-4 md:p-8 flex flex-col items-center justify-center">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2 flex items-center gap-3"><BrainCircuit className="h-8 w-8"/>{t('casinoGameChess')}</h1>
        <p className="text-muted-foreground">{t('chessChooseMode')}</p>
      </div>
      <GameCard
        name={t('casinoGameChess')}
        imageUrl="/images/echecs.jpg"
        onClick={() => router.push('/casino/chess')}
        dataAiHint="chess board"
      />
    </main>
  );
}
