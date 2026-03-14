'use client';

import React from 'react';

interface LinearLoadingScreenProps {
    message?: string;
}

export default function LinearLoadingScreen({ message = 'Loading...' }: LinearLoadingScreenProps) {
    return (
        <div className="flex items-center justify-center min-h-screen bg-[#f5f6f8] px-4">
            <div className="w-[280px] max-w-full">
                <div className="loading-line-track">
                    <div className="loading-line-runner" />
                </div>
                <p className="mt-3 text-center text-[12px] text-[#61758b] font-medium tracking-[0.03em]">
                    {message}
                </p>
            </div>
        </div>
    );
}
