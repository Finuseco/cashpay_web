
"use client"

import * as React from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAlertDialog, type AlertVariant } from "@/hooks/use-alert-dialog";
import { CheckCircle2, XCircle, AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/utils"

const ICONS: Record<AlertVariant, React.ReactNode> = {
  success: <CheckCircle2 className="h-16 w-16 text-green-500" />,
  error: <XCircle className="h-16 w-16 text-red-500" />,
  destructive: <XCircle className="h-16 w-16 text-red-600" />,
  warning: <AlertTriangle className="h-16 w-16 text-yellow-500" />,
  info: <Info className="h-16 w-16 text-blue-500" />,
};

const BUTTON_STYLES: Record<AlertVariant, string> = {
    success: 'bg-green-500 hover:bg-green-600 focus-visible:ring-green-500',
    error: 'bg-red-600 hover:bg-red-700 focus-visible:ring-red-600',
    destructive: 'bg-red-600 hover:bg-red-700 focus-visible:ring-red-600',
    warning: 'bg-yellow-500 hover:bg-yellow-600 focus-visible:ring-yellow-500',
    info: 'bg-primary hover:bg-primary/90 focus-visible:ring-primary',
}

export function GlobalAlertDialog() {
  const { isOpen, title, description, variant, showCancel, cancelText, confirmText, closeAlert } = useAlertDialog();

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && closeAlert(false)}>
      <AlertDialogContent>
        <AlertDialogHeader className="items-center text-center space-y-4">
          {ICONS[variant]}
          <AlertDialogTitle className="text-xl">{title}</AlertDialogTitle>
          {description && (
            <div className="text-sm text-muted-foreground">
                {description}
            </div>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter className="mt-4 flex flex-col sm:flex-row gap-2">
          {showCancel && (
            <AlertDialogCancel 
                onClick={() => closeAlert(false)}
                className="w-full sm:flex-1"
            >
                {cancelText}
            </AlertDialogCancel>
          )}
          <AlertDialogAction 
            onClick={() => closeAlert(true)}
            className={cn("w-full font-semibold text-primary-foreground sm:flex-1", BUTTON_STYLES[variant])}
          >
            {confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
