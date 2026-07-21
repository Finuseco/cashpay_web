
'use client';

import { useState, useEffect, useCallback } from 'react';

export const useAudio = (url: string, loop = false) => {
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);

  useEffect(() => {
    // We only want to create the Audio object on the client side.
    const audioInstance = new Audio(url);
    audioInstance.loop = loop;
    setAudio(audioInstance);

    return () => {
      // Cleanup: pause the audio and release resources when the component unmounts.
      audioInstance.pause();
      audioInstance.src = '';
    };
  }, [url, loop]);

  const play = useCallback(() => {
    if (audio) {
      audio.play().catch(error => {
        // Autoplay is often blocked by browsers, log the error but don't crash.
        console.error("Audio play failed:", error);
      });
    }
  }, [audio]);

  const stop = useCallback(() => {
    if (audio) {
      audio.pause();
      audio.currentTime = 0; // Rewind to the start
    }
  }, [audio]);

  return { play, stop };
};
