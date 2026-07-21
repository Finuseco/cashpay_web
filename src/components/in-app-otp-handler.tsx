'use client';

import { useState, useEffect } from 'react';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { checkForInAppOtpAction } from '@/lib/actions/otp.actions';

export function InAppOtpHandler({ userId }: { userId: number }) {
  const { openAlert } = useAlertDialog();

  useEffect(() => {
    const interval = setInterval(async () => {
      const result = await checkForInAppOtpAction(userId);
      if (result) {
        openAlert({
          variant: 'info',
          title: 'Code de Validation Requis',
          description: (
            <div>
              <p className="mb-2">Un agent demande une validation pour <strong>{result.type}</strong>. Veuillez lui fournir ce code :</p>
              <p className="text-2xl font-bold tracking-widest bg-muted p-2 rounded-md text-center">{result.otp}</p>
              <p className="text-xs text-muted-foreground mt-2">N'initiez pas cette transaction ? Ne partagez pas ce code.</p>
            </div>
          )
        });
      }
    }, 5000); // Check every 5 seconds

    return () => clearInterval(interval);
  }, [userId, openAlert]);

  return null; // This component does not render anything
}
