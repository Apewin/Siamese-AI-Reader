
export interface ScoreItem {
    description: string;
    pointsAwarded: number;
    maxPoints: number;
}

export interface GradingResult {
    studentName: string;
    recognizedText: string;
    feedback: string;
    totalScore: number;
    maxScore: number;
    scoreBreakdown: ScoreItem[];
}
