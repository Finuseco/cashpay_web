'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { RefreshCw, RotateCcw, RotateCw, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Image from 'next/image';
import Barcode from 'react-barcode';

interface Book3DProps {
    frontCover?: string;
    backCover?: string;
    className?: string;
    editionType?: 'cashpay' | 'external';
    title?: string;
    author?: string;
    isbn?: string;
}

export function Book3D({ frontCover, backCover, className, editionType = 'external', title, author, isbn }: Book3DProps) {
    const [rotation, setRotation] = useState(0);
    const [isAutoRotating, setIsAutoRotating] = useState(true);

    const toggleRotation = (direction: 'left' | 'right') => {
        setIsAutoRotating(false);
        setRotation(prev => direction === 'left' ? prev - 90 : prev + 90);
    };

    const isCashPayEdition = editionType === 'cashpay';

    return (
        <div className={cn("flex flex-col items-center gap-8 py-10", className)}>
            <div className="perspective-[1000px] w-64 h-96 relative group">
                <div 
                    className={cn(
                        "w-full h-full relative transition-transform duration-700 ease-out transform-style-3d",
                        isAutoRotating && "animate-[spin_10s_linear_infinite]"
                    )}
                    style={{ 
                        transform: !isAutoRotating ? `rotateY(${rotation}deg)` : undefined,
                    }}
                >
                    {/* Front Cover */}
                    <div className={cn(
                        "absolute inset-0 backface-hidden shadow-2xl rounded-r-md overflow-hidden z-10 translate-z-[15px]",
                        isCashPayEdition ? "bg-gradient-to-br from-[#000E38] to-[#001a5e] p-8 flex flex-col justify-between text-white border-r-4 border-orange-500" : ""
                    )}>
                        {isCashPayEdition ? (
                            <>
                                <div className="flex justify-between items-start">
                                    <img src="/logos/logo-white.png" alt="CashPay" className="h-6 w-auto" />
                                    <div className="h-2 w-8 bg-orange-500 rounded-full" />
                                </div>
                                <div className="flex-1 flex flex-col justify-center items-center text-center">
                                    <h2 className="text-xl font-black uppercase tracking-tight mb-2 leading-tight">{title || 'SANS TITRE'}</h2>
                                    <div className="w-12 h-1 bg-orange-500 mb-2" />
                                    <p className="text-sm font-medium opacity-80">{author || 'AUTEUR INCONNU'}</p>
                                </div>
                                <div className="text-[10px] uppercase font-bold tracking-widest text-center opacity-40">
                                    Certified Digital Edition
                                </div>
                            </>
                        ) : (
                            <img src={frontCover || 'https://placehold.co/600x900.png'} alt="Front Cover" className="w-full h-full object-cover" />
                        )}
                    </div>

                    {/* Back Cover */}
                    <div className={cn(
                        "absolute inset-0 backface-hidden shadow-2xl rounded-l-md overflow-hidden rotate-y-180 -translate-z-[15px]",
                        isCashPayEdition ? "bg-[#000E38] p-8 text-white flex flex-col justify-between" : "bg-zinc-800"
                    )}>
                        {isCashPayEdition ? (
                            <>
                                <div className="text-[10px] space-y-4 opacity-70">
                                    <p>Cet ouvrage est publié sous le label JoJo Library, une marque de l'écosystème souverain CashPay All.</p>
                                    <div className="flex items-center gap-2">
                                        <ShieldCheck className="h-4 w-4 text-orange-500"/>
                                        <span className="font-bold">CERTIFIÉ CASHPAY ALL</span>
                                    </div>
                                </div>
                                <div className="flex flex-col items-center gap-1 bg-white p-2 rounded-md">
                                    <p className="text-[8px] text-black font-black uppercase tracking-tighter">ISBN: {isbn || 'N/A'}</p>
                                    {isbn && (
                                        <div className="scale-75 -mt-2">
                                            <Barcode value={isbn.replace(/-/g, '')} height={30} width={1.2} fontSize={8} margin={0} />
                                        </div>
                                    )}
                                </div>
                            </>
                        ) : (
                            <img src={backCover || 'https://placehold.co/600x900.png'} alt="Back Cover" className="w-full h-full object-cover" />
                        )}
                    </div>

                    {/* Spine (La Tranche) */}
                    <div className="absolute top-0 bottom-0 left-0 w-[30px] bg-zinc-900 shadow-inner -rotate-y-90 -translate-x-[15px]">
                        <div className="w-full h-full border-r border-white/10 flex flex-col items-center justify-between py-4">
                             <img src="/logos/favicon.png" alt="CP" className="h-3 w-3 opacity-50" />
                             <span className="rotate-90 text-[8px] font-bold text-zinc-500 uppercase tracking-widest whitespace-nowrap">
                                {isCashPayEdition ? 'CashPay Library Edition' : 'Digital Volume'}
                             </span>
                             <div className="h-4 w-full bg-orange-500/50" />
                        </div>
                    </div>

                    {/* Pages (Tranche droite) */}
                    <div className="absolute top-0 bottom-0 right-0 w-[30px] bg-zinc-100 rotate-y-90 translate-x-[15px]">
                        <div className="w-full h-full flex flex-col justify-around py-1 opacity-20">
                            {[...Array(20)].map((_, i) => (
                                <div key={i} className="h-[1px] w-full bg-zinc-400" />
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-4 bg-zinc-100 p-2 rounded-full shadow-inner border border-zinc-200">
                <button className="rounded-full h-10 w-10 hover:bg-white flex items-center justify-center transition-colors" onClick={() => toggleRotation('left')}>
                    <RotateCcw className="h-5 w-5 text-zinc-600" />
                </button>
                <button 
                    className={cn(
                        "rounded-full px-6 h-10 font-bold flex items-center gap-2 transition-all",
                        isAutoRotating ? "bg-primary text-white" : "bg-white text-zinc-600 border"
                    )}
                    onClick={() => setIsAutoRotating(!isAutoRotating)}
                >
                    <RefreshCw className={cn("h-4 w-4", isAutoRotating && "animate-spin")} />
                    {isAutoRotating ? 'Rotation Auto' : 'Mode Manuel'}
                </button>
                <button className="rounded-full h-10 w-10 hover:bg-white flex items-center justify-center transition-colors" onClick={() => toggleRotation('right')}>
                    <RotateCw className="h-5 w-5 text-zinc-600" />
                </button>
            </div>
            
            <p className="text-[10px] text-zinc-400 uppercase tracking-tighter font-black">
                Touchez le livre pour inspecter le volume
            </p>

            <style jsx>{`
                .transform-style-3d { transform-style: preserve-3d; }
                .backface-hidden { backface-visibility: hidden; }
                .rotate-y-180 { transform: rotateY(180deg); }
                .rotate-y-90 { transform: rotateY(90deg); }
                .-rotate-y-90 { transform: rotateY(-90deg); }
                .translate-z-15 { transform: translateZ(15px); }
                .-translate-z-15 { transform: translateZ(-15px); }
                @keyframes spin {
                    from { transform: rotateY(0deg); }
                    to { transform: rotateY(360deg); }
                }
            `}</style>
        </div>
    );
}

