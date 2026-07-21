

'use client';

import { useRef, useCallback } from 'react';

export interface AudioFeedback {
    playIncomingCallSound: () => void;
    playOutgoingCallSound: () => void;
    playChatMessageSound: () => void;
    playMeetingCallSound: () => void;
    playNoAnswerSound: () => void;
    playOfflineSound: () => void;
    stopAllSounds: () => void;
}

export const useAudioFeedback = (): AudioFeedback => {
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const playSound = useCallback((soundFile: string, loop = false) => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
            audioRef.current = null;
        }

        const audio = new Audio(`/sounds/feedback/${soundFile}`);
        audio.loop = loop;
        audio.play().catch(error => console.error(`Error playing sound ${soundFile}:`, error));
        audioRef.current = audio;
    }, []);

    const stopAllSounds = useCallback(() => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
            audioRef.current = null;
        }
    }, []);

    const playIncomingCallSound = useCallback(() => playSound('call-enter.wav', true), [playSound]);
    const playOutgoingCallSound = useCallback(() => playSound('cell-phone-ring.wav', true), [playSound]);
    const playChatMessageSound = useCallback(() => playSound('chat.wav'), [playSound]);
    const playMeetingCallSound = useCallback(() => playSound('meeting-call.wav', true), [playSound]);
    const playNoAnswerSound = useCallback(() => {
        stopAllSounds();
        playSound('non-repond.mp3');
    }, [playSound, stopAllSounds]);
    const playOfflineSound = useCallback(() => {
        stopAllSounds();
        playSound('offline-goodbye.mp3');
    }, [playSound, stopAllSounds]);

    return {
        playIncomingCallSound,
        playOutgoingCallSound,
        playChatMessageSound,
        playMeetingCallSound,
        playNoAnswerSound,
        playOfflineSound,
        stopAllSounds,
    };
};
