import React from 'react';
import type { GradingResult, ScoreItem } from '../types';

interface ResultDisplayProps {
    result: GradingResult;
    studentPaperUrl: string;
}

const getScoreColor = (score: number, maxScore: number = 100) => {
    const percentage = maxScore > 0 ? (score / maxScore) * 100 : 0;
    if (percentage >= 90) return 'text-green-500';
    if (percentage >= 70) return 'text-yellow-500';
    if (percentage >= 50) return 'text-orange-500';
    return 'text-red-500';
};

const getScoreBgColor = (score: number, maxScore: number = 100) => {
    const percentage = maxScore > 0 ? (score / maxScore) * 100 : 0;
    if (percentage >= 90) return 'bg-green-500';
    if (percentage >= 70) return 'bg-yellow-500';
    if (percentage >= 50) return 'bg-orange-500';
    return 'bg-red-500';
}

const ScoreCircle: React.FC<{ score: number }> = ({ score }) => {
    const circumference = 2 * Math.PI * 45;
    const offset = circumference - (score / 100) * circumference;
    const color = getScoreColor(score);

    return (
        <div className="relative w-32 h-32">
            <svg className="w-full h-full" viewBox="0 0 100 100">
                <circle
                    className="text-gray-200 dark:text-gray-700"
                    strokeWidth="10"
                    stroke="currentColor"
                    fill="transparent"
                    r="45"
                    cx="50"
                    cy="50"
                />
                <circle
                    className={color}
                    strokeWidth="10"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="transparent"
                    r="45"
                    cx="50"
                    cy="50"
                    transform="rotate(-90 50 50)"
                />
            </svg>
            <div className={`absolute inset-0 flex items-center justify-center text-3xl font-bold ${color}`}>
                {score}
            </div>
        </div>
    );
};

const ScoreBreakdownItem: React.FC<{ item: ScoreItem }> = ({ item }) => (
    <li className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg">
        <p className="text-gray-700 dark:text-gray-300 flex-1 pr-4">{item.description}</p>
        <div className={`flex items-center justify-center font-bold text-white text-sm rounded-full px-3 py-1 ${getScoreBgColor(item.pointsAwarded, item.maxPoints)}`}>
            {item.pointsAwarded} / {item.maxPoints}
        </div>
    </li>
);

export const ResultDisplay: React.FC<ResultDisplayProps> = ({ result, studentPaperUrl }) => {
    return (
        <div className="p-6 md:p-10 space-y-8">
            <div className="text-center">
                <h2 className="text-2xl md:text-3xl font-bold text-indigo-600 dark:text-indigo-400 mb-2">Grading Complete</h2>
                {result.studentName && result.studentName.toLowerCase() !== 'n/a' && (
                    <p className="text-lg text-gray-600 dark:text-gray-400 mb-4">
                        Student: <span className="font-bold text-gray-800 dark:text-gray-200">{result.studentName}</span>
                    </p>
                )}
                <div className="flex justify-center">
                    <ScoreCircle score={result.totalScore} />
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Left column for score breakdown and feedback */}
                <div className="space-y-6">
                    <div>
                        <h3 className="text-xl font-semibold mb-3 border-b-2 border-gray-200 dark:border-gray-700 pb-2">Score Breakdown</h3>
                        <ul className="space-y-2 max-h-80 overflow-y-auto p-1">
                            {result.scoreBreakdown.map((item, index) => (
                                <ScoreBreakdownItem key={index} item={item} />
                            ))}
                        </ul>
                    </div>
                     <div>
                        <h3 className="text-xl font-semibold mb-3 border-b-2 border-gray-200 dark:border-gray-700 pb-2">AI Feedback</h3>
                        <div className="p-4 bg-white dark:bg-gray-800 rounded-lg max-h-60 overflow-y-auto whitespace-pre-wrap">
                            {result.feedback}
                        </div>
                    </div>
                    <div>
                        <details className="bg-white dark:bg-gray-800 rounded-lg">
                             <summary className="cursor-pointer p-3 text-lg font-semibold text-gray-700 dark:text-gray-300">
                                Recognized Text
                             </summary>
                             <div className="p-4 border-t border-gray-200 dark:border-gray-700 max-h-60 overflow-y-auto whitespace-pre-wrap font-mono text-sm">
                                {result.recognizedText || <span className="text-gray-500">No text recognized.</span>}
                             </div>
                        </details>
                    </div>
                </div>

                {/* Right column for PDF viewer */}
                <div>
                    <h3 className="text-xl font-semibold mb-3 border-b-2 border-gray-200 dark:border-gray-700 pb-2">Original Paper</h3>
                    <div className="relative bg-white dark:bg-gray-800 rounded-lg overflow-hidden h-[48rem]">
                        <iframe
                            src={studentPaperUrl}
                            title="Original Student Paper"
                            width="100%"
                            height="100%"
                            className="border-none"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};
