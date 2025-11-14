
import React from 'react';
import { LogoIcon } from './icons/LogoIcon';

export const Header: React.FC = () => {
    return (
        <header className="bg-white dark:bg-gray-800 shadow-md">
            <div className="container mx-auto px-4 md:px-8 py-4 flex items-center justify-center text-center">
                <LogoIcon className="h-10 w-10 md:h-12 md:w-12 text-indigo-600 dark:text-indigo-400 mr-4" />
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
                        AI Handwriting Grader
                    </h1>
                    <p className="text-sm md:text-md text-gray-500 dark:text-gray-400">
                        Instant feedback on handwritten work powered by Gemini
                    </p>
                </div>
            </div>
        </header>
    );
};
