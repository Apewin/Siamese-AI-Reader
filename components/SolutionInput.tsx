
import React, { useState, useRef, useCallback } from 'react';
import { UploadIcon } from './icons/UploadIcon';
import { PdfIcon } from './icons/PdfIcon';

interface SolutionInputProps {
    onFileChange: (file: File | null) => void;
}

export const SolutionInput: React.FC<SolutionInputProps> = ({ onFileChange }) => {
    const [fileName, setFileName] = useState<string>('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setFileName(file.name);
            onFileChange(file);
        } else {
            setFileName('');
            onFileChange(null);
        }
    }, [onFileChange]);

    const handleButtonClick = () => {
        fileInputRef.current?.click();
    };

    return (
        <div className="flex flex-col h-full">
            <label className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">2. Provide Correct Solution</label>
            <div
                className="flex-grow flex flex-col justify-center items-center border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center bg-gray-50 dark:bg-gray-700/50 cursor-pointer hover:border-indigo-500 dark:hover:border-indigo-400 transition-colors duration-300"
                onClick={handleButtonClick}
            >
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    className="hidden"
                    accept="application/pdf"
                />
                {fileName ? (
                    <div className="flex flex-col items-center text-gray-700 dark:text-gray-300">
                        <PdfIcon className="h-12 w-12 mb-2 text-indigo-500" />
                        <span className="font-semibold break-all">{fileName}</span>
                    </div>
                ) : (
                    <div className="flex flex-col items-center text-gray-500 dark:text-gray-400">
                        <UploadIcon className="h-12 w-12 mb-2" />
                        <span className="font-semibold">Click to upload a PDF</span>
                        <span className="text-sm">Solution File</span>
                    </div>
                )}
            </div>
        </div>
    );
};
