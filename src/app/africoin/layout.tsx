'use client';

import React from 'react';
import { AfriCoinHeader } from './africoin-header';
import { AfriCoinFooter } from './africoin-footer';

export default function AfriCoinLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col h-full bg-zinc-900 text-white">
      {/* The header is now handled within the page to pass the selected currency */}
      <main className="flex-1 overflow-y-auto pb-20">
        {children}
      </main>
      <AfriCoinFooter />
    </div>
  );
}
