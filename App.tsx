
import React, { useState, useCallback, useEffect } from 'react';
import { Header } from './components/Header';
import { FileUpload } from './components/FileUpload';
import { SolutionInput } from './components/SolutionInput';
import { ResultDisplay } from './components/ResultDisplay';
import { Spinner } from './components/Spinner';
import { gradeHandwriting } from './services/geminiService';
import type { GradingResult } from './types';
import { GradeIcon } from './components/icons/GradeIcon';
import { AlertTriangleIcon } from './components/icons/AlertTriangleIcon';

const App: React.FC = () => {
    const [studentPaper, setStudentPaper] = useState<File | null>(null);
    const [studentPaperUrl, setStudentPaperUrl] = useState<string | null>(null);
    const [solutionFile, setSolutionFile] = useState<File | null>(null);
    const [gradingResult, setGradingResult] = useState<GradingResult | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const handleFileChange = useCallback((file: File | null) => {
        setStudentPaper(file);
        setGradingResult(null);
        setError(null);

        setStudentPaperUrl(prevUrl => {
            if (prevUrl) {
                URL.revokeObjectURL(prevUrl);
            }
            return file ? URL.createObjectURL(file) : null;
        });
    }, []);
    
    // Cleanup effect for the object URL
    useEffect(() => {
        return () => {
            if (studentPaperUrl) {
                URL.revokeObjectURL(studentPaperUrl);
            }
        };
    }, [studentPaperUrl]);

    const handleSolutionFileChange = useCallback((file: File | null) => {
        setSolutionFile(file);
        setGradingResult(null);
        setError(null);
    }, []);

    const handleGradeClick = async () => {
        if (!studentPaper || !solutionFile) {
            setError('Please upload a student paper and a solution PDF.');
            return;
        }

        setIsLoading(true);
        setError(null);
        setGradingResult(null);

        try {
            const result = await gradeHandwriting(studentPaper, solutionFile);
            setGradingResult(result);
        } catch (err) {
            console.error(err);
            setError(err instanceof Error ? err.message : 'An unexpected error occurred. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen font-sans text-gray-800 dark:text-gray-200 transition-colors duration-300">
            <Header />
            <main className="container mx-auto p-4 md:p-8">
                <div className="max-w-4xl mx-auto bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden">
                    <div className="p-6 md:p-10">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                            <FileUpload onFileChange={handleFileChange} />
                            <SolutionInput onFileChange={handleSolutionFileChange} />
                        </div>

                        <div className="text-center">
                            <button
                                onClick={handleGradeClick}
                                disabled={isLoading || !studentPaper || !solutionFile}
                                className="w-full md:w-auto inline-flex items-center justify-center px-8 py-4 bg-indigo-600 text-white font-bold rounded-xl shadow-lg hover:bg-indigo-700 disabled:bg-indigo-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-indigo-500 focus:ring-opacity-50"
                            >
                                {isLoading ? (
                                    <>
                                        <Spinner />
                                        Grading in Progress...
                                    </>
                                ) : (
                                    <>
                                        <GradeIcon className="h-6 w-6 mr-3" />
                                        Grade Paper
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                    
                    {error && (
                        <div className="bg-red-50 dark:bg-red-900/20 border-t border-red-200 dark:border-gray-700 p-6">
                            <div className="flex items-center text-red-600 dark:text-red-400">
                                <AlertTriangleIcon className="h-6 w-6 mr-3 flex-shrink-0" />
                                <p className="font-semibold">{error}</p>
                            </div>
                        </div>
                    )}
                    
                    {gradingResult && studentPaperUrl && (
                       <div className="bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700">
                           <ResultDisplay result={gradingResult} studentPaperUrl={studentPaperUrl} />
                       </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default App;
