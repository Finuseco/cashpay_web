'use client';

import * as React from 'react';
import { Scanner, type IDetectedBarcode, type BarcodeFormat } from '@yudiel/react-qr-scanner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Loader2, VideoOff, ScanLine, Barcode } from 'lucide-react';
import { useTranslation } from "react-i18next";
import { Button } from '@/components/ui/button';
import { cn } from "@/lib/utils";

interface QrScannerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScanSuccess: (data: string) => void;
  mode?: 'qr' | 'barcode' | 'all';
}

const QR_FORMATS: BarcodeFormat[] = ['qr_code'];
const BARCODE_FORMATS: BarcodeFormat[] = ['ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e'];
const ALL_FORMATS: BarcodeFormat[] = [...QR_FORMATS, ...BARCODE_FORMATS, 'data_matrix', 'itf'];

export function QrScannerDialog({ open, onOpenChange, onScanSuccess, mode = 'all' }: QrScannerDialogProps) {
  const { t } = useTranslation();
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [hasCameraError, setHasCameraError] = React.useState(false);

  const supportedFormats = React.useMemo(() => {
    if (mode === 'qr') return QR_FORMATS;
    if (mode === 'barcode') return BARCODE_FORMATS;
    return ALL_FORMATS;
  }, [mode]);

  const handleScan = React.useCallback((result: IDetectedBarcode[]) => {
    if (isProcessing || !open) return;

    const text = result[0]?.rawValue;
    if (text) {
        setIsProcessing(true);
        onScanSuccess(text);
    }
  }, [isProcessing, open, onScanSuccess]);
  
  const handleError = (error: any) => {
    console.error('Scanner Error:', error);
    setHasCameraError(true);
  };
  
  React.useEffect(() => {
    if (!open) {
      setIsProcessing(false);
      setHasCameraError(false);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 sm:rounded-2xl overflow-hidden max-w-sm border-none bg-black">
        <DialogHeader className="p-4 bg-background border-b">
          <DialogTitle className="flex items-center gap-2 text-foreground">
            {mode === 'barcode' ? <Barcode className="h-5 w-5 text-primary" /> : <ScanLine className="h-5 w-5 text-primary" />}
            {mode === 'barcode' ? 'Scanner Code-barres' : (mode === 'qr' ? 'Scanner QR Code' : 'Scanner Code')}
          </DialogTitle>
          <DialogDescription>
            {mode === 'barcode' ? 'Alignez le code-barres horizontalement.' : 'Placez le code dans le cadre pour le scanner.'}
          </DialogDescription>
        </DialogHeader>
        
        <div className="relative aspect-square w-full bg-zinc-950 flex items-center justify-center">
          {/* Guide visuel s'adaptant au format */}
          <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center">
            <div className={cn(
                "border-2 border-white/20 rounded-3xl relative overflow-hidden transition-all duration-300",
                mode === 'barcode' ? "w-[85%] h-32" : "w-64 h-64"
            )}>
                <div className="absolute top-0 left-0 right-0 h-1 bg-primary shadow-[0_0_20px_rgba(255,102,0,0.8)] animate-scan-line" />
                <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-primary rounded-tl-xl"></div>
                <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-primary rounded-tr-xl"></div>
                <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-primary rounded-bl-xl"></div>
                <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-primary rounded-br-xl"></div>
            </div>
          </div>

          {hasCameraError ? (
              <div className="text-white flex flex-col items-center justify-center h-full text-center p-8 space-y-6">
                  <div className="bg-red-500/20 p-6 rounded-full">
                    <VideoOff className="h-12 w-12 text-red-500" />
                  </div>
                  <div className="space-y-2">
                    <p className="font-bold text-lg">Accès Caméra Impossible</p>
                    <p className="text-sm text-zinc-400">Veuillez autoriser l'accès à la caméra ou rafraîchir la page.</p>
                  </div>
                  <Button variant="outline" className="border-white/20 text-white hover:bg-white/10" onClick={() => onOpenChange(false)}>Fermer</Button>
              </div>
          ) : (
            <div className="w-full h-full">
                {open && (
                    <Scanner
                        key={open ? `scanner-${mode}` : 'inactive'}
                        onScan={handleScan}
                        onError={handleError}
                        formats={supportedFormats}
                        constraints={{ 
                            facingMode: 'environment',
                            aspectRatio: 1
                        }}
                        styles={{
                            container: { width: '100%', height: '100%', paddingTop: '0' },
                            video: { objectFit: 'cover', width: '100%', height: '100%' }
                        }}
                    />
                )}
            </div>
          )}
          
          {isProcessing && (
              <div className="absolute inset-0 z-20 bg-black/60 flex flex-col items-center justify-center gap-4">
                  <Loader2 className="h-12 w-12 animate-spin text-primary" />
                  <p className="text-white text-xs font-bold uppercase tracking-widest">Traitement...</p>
              </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
