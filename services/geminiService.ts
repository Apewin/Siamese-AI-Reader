import { GoogleGenAI, Type } from "@google/genai";
import { fileToGenerativePart } from '../utils/fileUtils';
import type { GradingResult } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

export async function gradeHandwriting(paperImage: File, solutionFile: File): Promise<GradingResult> {
    try {
        const imagePart = await fileToGenerativePart(paperImage);
        const solutionPart = await fileToGenerativePart(solutionFile);

        const prompt = `
You are an expert teaching assistant. Your tasks are to perform a detailed evaluation of a student's handwritten paper against a provided solution document.

**Instructions:**
1.  **Identify Student Name:** Look for a name written on the student's paper. If found, extract it. If no name is clearly identifiable, return "N/A".
2.  **Analyze Solution Document:** The second file is a PDF containing the correct solution. First, carefully analyze this document to identify all distinct questions, problems, or scoring criteria. Determine the maximum possible points for each criterion.
3.  **Transcribe Student Paper:** The first file is a PDF of the student's handwritten work. Transcribe the text from this PDF.
4.  **Grade Point-by-Point:** For each scoring criterion identified from the solution, find the student's corresponding answer on their paper. Compare it to the solution and award points accordingly.
5.  **Calculate Total Score:** Sum the points awarded for all criteria to get a total score. Assume the total is out of 100.
6.  **Provide Feedback & Breakdown:** Return a JSON object containing the student's name, the transcribed text, overall constructive feedback, the final total score, and a detailed breakdown array. Each object in the breakdown should specify the scoring criterion, the points the student earned, and the maximum points for that item.
`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [{text: prompt}, imagePart, solutionPart] },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        studentName: {
                            type: Type.STRING,
                            description: "The name of the student identified from the paper. Should be 'N/A' if not found."
                        },
                        recognizedText: {
                            type: Type.STRING,
                            description: "The verbatim text transcribed from the student's handwritten paper."
                        },
                        feedback: {
                            type: Type.STRING,
                            description: "Overall constructive feedback for the student, summarizing their performance."
                        },
                        totalScore: {
                            type: Type.NUMBER,
                            description: "The final total score for the paper, out of 100."
                        },
                        scoreBreakdown: {
                            type: Type.ARRAY,
                            description: "A detailed breakdown of the score for each question or scoring point.",
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    description: {
                                        type: Type.STRING,
                                        description: "Description of the question or scoring criterion from the solution file."
                                    },
                                    pointsAwarded: {
                                        type: Type.NUMBER,
                                        description: "The points awarded to the student for this specific item."
                                    },
                                    maxPoints: {
                                        type: Type.NUMBER,
                                        description: "The maximum possible points for this specific item."
                                    }
                                },
                                required: ["description", "pointsAwarded", "maxPoints"]
                            }
                        }
                    },
                    required: ["studentName", "recognizedText", "feedback", "totalScore", "scoreBreakdown"]
                }
            }
        });
        
        const jsonText = response.text.trim();
        const result: GradingResult = JSON.parse(jsonText);

        return result;

    } catch (error) {
        console.error("Error calling Gemini API:", error);
        throw new Error("Failed to grade the paper. The AI model could not process the request.");
    }
}
