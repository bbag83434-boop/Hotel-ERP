'use client';

import React from 'react';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center bg-[#F5F3EE]">
      <h1 className="text-4xl font-bold text-[#1C1C1C]">404</h1>
      <p className="mt-2 text-sm text-[#707070]">Page not found</p>
      <a href="/" className="mt-4 text-xs font-bold text-[#B8862D] underline">
        Go Back Home
      </a>
    </div>
  );
}
