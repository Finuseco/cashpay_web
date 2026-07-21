
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Maximize, Minimize } from 'lucide-react';
import { Button } from './button';

export function FullscreenToggle() {
    const [isFullscreen, setIsFullscreen] = useState(false);
    
    // Using useCallback to memoize the function
    const checkFullscreenStatus = useCallback(() => {
        if (typeof document !== 'undefined') {
            setIsFullscreen(!!document.fullscreenElement);
        }
    }, []);

    useEffect(() => {
        document.addEventListener('fullscreenchange', checkFullscreenStatus);
        
        // Initial check in case the component mounts while already in fullscreen
        checkFullscreenStatus();

        return () => document.removeEventListener('fullscreenchange', checkFullscreenStatus);
    }, [checkFullscreenStatus]);

    const toggleFullscreen = () => {
        if (typeof document === 'undefined') return;

        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                // Log the error for debugging but don't alert the user
                console.error(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
            });
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            }
        }
    };
    
    // Hide the button on server-side rendering or if the API is not supported
    const [isClient, setIsClient] = useState(false);
    useEffect(() => {
        setIsClient(true);
    }, []);

    if (!isClient || (typeof document !== 'undefined' && !document.fullscreenEnabled)) {
        return null;
    }

    return (
        <Button onClick={toggleFullscreen} variant="ghost" size="icon">
            {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
            <span className="sr-only">Toggle Fullscreen</span>
        </Button>
    );
}
