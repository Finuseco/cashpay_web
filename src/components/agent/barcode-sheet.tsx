
'use client';

import React, { useState, useRef } from 'react';
import Barcode from 'react-barcode';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Printer, Download, QrCode, Barcode as BarcodeIcon, Loader2 } from 'lucide-react';
import type { Product } from '@/lib/types';
import { cn } from '@/lib/utils';
import html2canvas from 'html2canvas';

const BarcodeLabel = ({ product, variation }: { product: Product, variation: any }) => {
    const [codeType, setCodeType] = useState<'barcode' | 'qr'>('barcode');
    const [isDownloading, setIsDownloading] = useState(false);
    const labelRef = useRef<HTMLDivElement>(null);

    const handleDownload = async () => {
        if (!labelRef.current) return;
        setIsDownloading(true);
        try {
            const canvas = await html2canvas(labelRef.current, {
                scale: 3,
                backgroundColor: '#ffffff',
                logging: false,
                useCORS: true
            });
            const link = document.createElement('a');
            link.download = `label-${product.name.replace(/\s+/g, '_')}-${variation.color}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        } catch (error) {
            console.error("Error generating label image:", error);
        } finally {
            setIsDownloading(false);
        }
    };

    const handlePrintIndividual = () => {
        const printContent = labelRef.current?.innerHTML;
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(`
                <html>
                    <head>
                        <title>Imprimer Étiquette</title>
                        <style>
                            body { margin: 0; display: flex; justify-content: center; align-items: center; height: 100vh; font-family: sans-serif; }
                            .print-label { padding: 10px; border: 1px solid #ccc; text-align: center; width: 60mm; }
                            .name { font-weight: bold; font-size: 14px; margin-bottom: 2px; }
                            .price { font-size: 12px; margin-bottom: 8px; color: #333; }
                            .code-container { display: flex; justify-content: center; }
                            svg { max-width: 100%; height: auto !important; }
                        </style>
                    </head>
                    <body>
                        <div class="print-label">${printContent}</div>
                        <script>
                            window.onload = () => {
                                window.print();
                                window.close();
                            };
                        </script>
                    </body>
                </html>
            `);
            printWindow.document.close();
        }
    };

    const qrValue = JSON.stringify({ type: 'PRODUCT', productId: product.id });

    return (
        <div className="flex flex-col gap-2 p-3 bg-white border rounded-xl shadow-sm hover:shadow-md transition-shadow group">
            {/* Label Content (The part that gets printed/downloaded) */}
            <div ref={labelRef} className="bg-white p-2 flex flex-col items-center text-center">
                <p className="text-xs font-bold text-black truncate w-full name">{product.name}</p>
                <p className="text-[10px] font-semibold text-zinc-600 mb-2 price">${product.sellingPrice.toFixed(2)}</p>
                
                <div className="flex justify-center items-center h-16 w-full code-container">
                    {codeType === 'barcode' ? (
                        <Barcode 
                            value={product.barcode || '000000'} 
                            height={40} 
                            width={1.2} 
                            fontSize={10} 
                            margin={0}
                            background="transparent"
                        />
                    ) : (
                        <QRCodeSVG value={qrValue} size={60} level="M" />
                    )}
                </div>
            </div>

            {/* Controls (Hidden during print) */}
            <div className="flex flex-col gap-2 mt-2 pt-2 border-t print:hidden">
                <div className="flex gap-1">
                    <Button 
                        variant={codeType === 'barcode' ? 'default' : 'outline'} 
                        size="sm" 
                        className="flex-1 h-7 text-[10px] gap-1"
                        onClick={() => setCodeType('barcode')}
                    >
                        <BarcodeIcon className="h-3 w-3" /> Barcode
                    </Button>
                    <Button 
                        variant={codeType === 'qr' ? 'default' : 'outline'} 
                        size="sm" 
                        className="flex-1 h-7 text-[10px] gap-1"
                        onClick={() => setCodeType('qr')}
                    >
                        <QrCode className="h-3 w-3" /> QR Code
                    </Button>
                </div>
                <div className="flex gap-1">
                    <Button 
                        variant="secondary" 
                        size="sm" 
                        className="flex-1 h-7 text-[10px] gap-1"
                        onClick={handlePrintIndividual}
                    >
                        <Printer className="h-3 w-3" /> Imprimer
                    </Button>
                    <Button 
                        variant="secondary" 
                        size="sm" 
                        className="flex-1 h-7 text-[10px] gap-1"
                        onClick={handleDownload}
                        disabled={isDownloading}
                    >
                        {isDownloading ? <Loader2 className="h-3 w-3 animate-spin"/> : <Download className="h-3 w-3" />} PNG
                    </Button>
                </div>
            </div>
        </div>
    );
};

export function BarcodeSheet({ products }: { products: Product[] }) {
    const handlePrintAll = () => {
        window.print();
    };

    return (
        <>
            <style>
            {`
                @media print {
                    body > *:not(#printable-barcodes-container) {
                        display: none !important;
                    }
                    #printable-barcodes-container {
                        display: block !important;
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                    }
                    .label-grid {
                        display: grid !important;
                        grid-template-columns: repeat(4, 1fr) !important;
                        gap: 10px !important;
                        padding: 0 !important;
                    }
                    @page {
                        size: A4;
                        margin: 10mm;
                    }
                }
            `}
            </style>
            
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 print:hidden">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-foreground">Gestion des Étiquettes</h1>
                    <p className="text-muted-foreground">Personnalisez, téléchargez ou imprimez les étiquettes pour vos rayons.</p>
                </div>
                <Button onClick={handlePrintAll} size="lg" variant="gradient" className="font-bold shadow-lg">
                    <Printer className="mr-2 h-5 w-5" /> Imprimer toute la page
                </Button>
            </div>
            
            <div id="printable-barcodes-container">
                <div className="label-grid grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {products.length > 0 ? products.flatMap(product => 
                        (product.variations && product.variations.length > 0 ? product.variations : [{color: 'Unique'}]).map((variation, vIdx) => (
                            <BarcodeLabel key={`${product.id}-${vIdx}`} product={product} variation={variation} />
                        ))
                    ) : (
                        <div className="col-span-full text-center py-20 text-muted-foreground border-2 border-dashed rounded-2xl print:hidden">
                            <BarcodeIcon className="h-12 w-12 mx-auto mb-2 opacity-20" />
                            <p>Aucun produit disponible pour l'étiquetage.</p>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
