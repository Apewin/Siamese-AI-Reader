import React, { useState, useRef } from 'react';
import { GoogleGenAI, Schema, Type } from "@google/genai";
import { GradingResult } from './types';

const DEFAULT_QUESTION = "Explain the concept of 'Federalism' in the context of the United States Constitution and provide one example of a power reserved for the states.";
const DEFAULT_RUBRIC_TEXT = "1 point: Correct definition of Federalism (division of power between national and state governments).\n1 point: Correct example of a state power (e.g., education, driving laws, elections).";

const MODELS = [
  { id: 'gemini-3-pro-preview', name: 'Gemini 3.0 Pro (Strongest Reasoning)' },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (Fast & Efficient)' },
];

const ACCEPTED_TYPES = "image/*,application/pdf,.heic,.HEIC";

export default function App() {
  // --- State ---
  
  // 0. Model Selection
  const [model, setModel] = useState<string>(MODELS[0].id);

  // 1. Student Response (Image/PDF)
  const [studentFile, setStudentFile] = useState<File | null>(null);
  const [studentPreview, setStudentPreview] = useState<string | null>(null);
  const [isDraggingStudent, setIsDraggingStudent] = useState(false);

  // 2. Question Context
  const [question, setQuestion] = useState<string>(DEFAULT_QUESTION);

  // 3. Rubric / Standard Answer
  const [rubricMode, setRubricMode] = useState<'text' | 'file'>('text');
  const [rubricText, setRubricText] = useState<string>(DEFAULT_RUBRIC_TEXT);
  const [rubricFile, setRubricFile] = useState<File | null>(null);
  const [rubricPreview, setRubricPreview] = useState<string | null>(null);
  const [isDraggingRubric, setIsDraggingRubric] = useState(false);
  
  // 4. App State
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<GradingResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Refs
  const studentInputRef = useRef<HTMLInputElement>(null);
  const rubricInputRef = useRef<HTMLInputElement>(null);

  // --- Helpers ---

  const processFile = (
    file: File | undefined, 
    setFile: (f: File) => void, 
    setPreview: (s: string | null) => void
  ) => {
    if (!file) return;

    // Validate type loosely (allow pdf, images, and heic extension)
    const isHeic = file.name.toLowerCase().endsWith('.heic');
    const isValidType = file.type.startsWith('image/') || file.type === 'application/pdf' || isHeic;

    if (!isValidType) {
      setError("Unsupported file type. Please upload an Image, PDF, or HEIC file.");
      return;
    }

    setFile(file);
    setResult(null);
    setError(null);

    if (file.type.startsWith('image/') && !isHeic) {
      const reader = new FileReader();
      reader.onloadend = () => setPreview(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      // For PDF and HEIC, we don't show a standard image preview
      setPreview(null); 
    }
  };

  const handleFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>, 
    setFile: (f: File) => void, 
    setPreview: (s: string | null) => void
  ) => {
    processFile(e.target.files?.[0], setFile, setPreview);
  };

  // --- Drag & Drop Handlers ---

  const handleDragOver = (e: React.DragEvent, setIsDragging: (b: boolean) => void) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent, setIsDragging: (b: boolean) => void) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (
    e: React.DragEvent, 
    setIsDragging: (b: boolean) => void,
    setFile: (f: File) => void,
    setPreview: (s: string | null) => void
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      processFile(files[0], setFile, setPreview);
    }
  };

  const fileToGenerativePart = (file: File): Promise<{ inlineData: { data: string; mimeType: string } }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          const base64Data = reader.result.split(',')[1];
          
          // Fix MIME type for HEIC if browser doesn't detect it
          let mimeType = file.type;
          if (file.name.toLowerCase().endsWith('.heic')) {
            mimeType = 'image/heic';
          }

          resolve({
            inlineData: {
              data: base64Data,
              mimeType: mimeType,
            },
          });
        } else {
          reject(new Error("Failed to read file"));
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // --- Core Logic ---

  const handleGrade = async () => {
    if (!studentFile) {
      setError("Please upload the student's answer.");
      return;
    }
    if (!question.trim()) {
      setError("Please enter the Question Prompt.");
      return;
    }
    if (rubricMode === 'text' && !rubricText.trim()) {
      setError("Please enter the grading rubric text.");
      return;
    }
    if (rubricMode === 'file' && !rubricFile) {
      setError("Please upload the grading rubric/answer key file.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

      const parts: any[] = [];

      // 1. Add Student Answer File
      const studentPart = await fileToGenerativePart(studentFile);
      parts.push(studentPart);

      let prompt = "";

      // 2. Add Rubric (Text or File)
      if (rubricMode === 'file' && rubricFile) {
        const rubricPart = await fileToGenerativePart(rubricFile);
        parts.push(rubricPart);
        
        prompt = `
          Role: You are an expert AP Exam Reader.
          
          Inputs:
          1. The first file provided is the STUDENT'S RESPONSE (Handwritten or Digital).
          2. The second file provided is the RUBRIC / STANDARD ANSWER KEY.
          
          Context:
          - Question Prompt: "${question}"
          
          Task:
          1. Transcribe the Student's Response into text.
          2. Analyze the Student's Response against the criteria shown in the Rubric/Key file.
          3. Grade strictly based on the evidence in the student's response.
        `;
      } else {
        prompt = `
          Role: You are an expert AP Exam Reader.
          
          Inputs:
          1. The file provided is the STUDENT'S RESPONSE.
          
          Context:
          - Question Prompt: "${question}"
          - Grading Rubric: "${rubricText}"
          
          Task:
          1. Transcribe the Student's Response.
          2. Grade strictly based on the provided Rubric text.
        `;
      }

      const responseSchema: Schema = {
        type: Type.OBJECT,
        properties: {
          studentName: { type: Type.STRING, description: "Name of student if found, else 'Student'" },
          recognizedText: { type: Type.STRING, description: "Transcription of student response" },
          feedback: { type: Type.STRING, description: "Detailed feedback explaining the score" },
          totalScore: { type: Type.NUMBER, description: "Total points awarded" },
          maxScore: { type: Type.NUMBER, description: "Total possible points" },
          scoreBreakdown: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                description: { type: Type.STRING, description: "Rubric criterion" },
                pointsAwarded: { type: Type.NUMBER, description: "Points given" },
                maxPoints: { type: Type.NUMBER, description: "Max points for this item" },
              },
              required: ["description", "pointsAwarded", "maxPoints"],
            },
          },
        },
        required: ["studentName", "recognizedText", "feedback", "totalScore", "maxScore", "scoreBreakdown"],
      };

      const response = await ai.models.generateContent({
        model: model,
        contents: {
          parts: [...parts, { text: prompt }],
        },
        config: {
          systemInstruction: "You are a strict and precise grader. Always verify OCR accuracy before grading.",
          responseMimeType: "application/json",
          responseSchema: responseSchema,
          thinkingConfig: { thinkingBudget: 1024 },
        },
      });

      let jsonText = response.text;
      if (jsonText) {
        jsonText = jsonText.replace(/^```json\s*/, "").replace(/\s*```$/, "");
        const parsedResult = JSON.parse(jsonText) as GradingResult;
        setResult(parsedResult);
      } else {
        throw new Error("No response received from AI.");
      }

    } catch (err: any) {
      console.error(err);
      setError(err.message || "An error occurred. Please ensure files are valid images or PDFs.");
    } finally {
      setIsLoading(false);
    }
  };

  const isReady = studentFile && question.trim() && (rubricMode === 'text' ? rubricText.trim() : rubricFile);

  // Render helper for file preview
  const renderFilePreview = (file: File, preview: string | null, isSmall = false) => {
    const isHeic = file.name.toLowerCase().endsWith('.heic');
    
    if (file.type.startsWith('image/') && !isHeic && preview) {
      return <img src={preview} alt="Preview" className={isSmall ? "thumb" : ""} />;
    }
    
    // Generic icons for PDF or HEIC
    const label = isHeic ? "HEIC" : "PDF";
    const iconClass = isSmall ? "pdf-icon-small" : "pdf-icon-box"; // New class for large preview box
    
    if (isSmall) {
      return <div className={iconClass}>{label}</div>;
    }
    
    return (
      <div className="pdf-icon">
         {/* Reusing pdf-icon class structure but changing label */}
        <span>{label}</span>
        <p>{file.name}</p>
      </div>
    );
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <img 
          src="./siamese.png" 
          alt="Siamese Cat Logo" 
          className="app-logo" 
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.src = "https://placekitten.com/200/200";
            target.onerror = null;
          }}
        />
        <h1>Siamese <span>AI Grader</span></h1>
        <p>Upload answers and rubrics to grade instantly.</p>
        
        <div className="model-selector-container">
          <label htmlFor="model-select">Model:</label>
          <select 
            id="model-select"
            value={model} 
            onChange={(e) => setModel(e.target.value)}
            className="model-select"
          >
            {MODELS.map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>
      </header>

      <main className="main-content">
        {/* --- Left Column: Inputs --- */}
        <section className="input-section">
          
          {/* 1. Student Response Card */}
          <div className="card input-card">
            <h2>1. Student Response</h2>
            <div 
              className={`drop-zone ${studentFile ? 'has-file' : ''} ${isDraggingStudent ? 'drag-active' : ''}`}
              onClick={() => studentInputRef.current?.click()}
              onDragOver={(e) => handleDragOver(e, setIsDraggingStudent)}
              onDragLeave={(e) => handleDragLeave(e, setIsDraggingStudent)}
              onDrop={(e) => handleDrop(e, setIsDraggingStudent, setStudentFile, setStudentPreview)}
            >
              <input 
                type="file" 
                ref={studentInputRef} 
                onChange={(e) => handleFileUpload(e, setStudentFile, setStudentPreview)} 
                accept={ACCEPTED_TYPES}
                hidden 
              />
              
              {studentFile ? (
                <div className="file-preview">
                  {renderFilePreview(studentFile, studentPreview)}
                  <button 
                    className="change-file-btn"
                    onClick={(e) => { e.stopPropagation(); studentInputRef.current?.click(); }}
                  >
                    Change File
                  </button>
                </div>
              ) : (
                <div className="upload-placeholder">
                  <span className="icon">📄</span>
                  <p>Drag & Drop Student Answer<br/><small>(Image, HEIC, or PDF)</small></p>
                </div>
              )}
            </div>
          </div>

          {/* 2. Question & Rubric Card */}
          <div className="card input-card">
            <h2>2. Question & Rubric</h2>
            
            <div className="form-group">
              <label>Question Prompt</label>
              <textarea 
                value={question} 
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Enter the exam question..."
                rows={3}
              />
            </div>

            <div className="form-group">
              <div className="label-row">
                <label>Rubric / Answer Key</label>
                <div className="toggle-switch">
                  <button 
                    className={rubricMode === 'text' ? 'active' : ''} 
                    onClick={() => setRubricMode('text')}
                  >
                    Text
                  </button>
                  <button 
                    className={rubricMode === 'file' ? 'active' : ''} 
                    onClick={() => setRubricMode('file')}
                  >
                    Upload File
                  </button>
                </div>
              </div>

              {rubricMode === 'text' ? (
                <textarea 
                  value={rubricText} 
                  onChange={(e) => setRubricText(e.target.value)}
                  placeholder="Enter scoring criteria..."
                  rows={6}
                  className="rubric-textarea fade-in"
                />
              ) : (
                <div 
                  className={`drop-zone small-drop-zone fade-in ${rubricFile ? 'has-file' : ''} ${isDraggingRubric ? 'drag-active' : ''}`}
                  onClick={() => rubricInputRef.current?.click()}
                  onDragOver={(e) => handleDragOver(e, setIsDraggingRubric)}
                  onDragLeave={(e) => handleDragLeave(e, setIsDraggingRubric)}
                  onDrop={(e) => handleDrop(e, setIsDraggingRubric, setRubricFile, setRubricPreview)}
                >
                  <input 
                    type="file" 
                    ref={rubricInputRef} 
                    onChange={(e) => handleFileUpload(e, setRubricFile, setRubricPreview)} 
                    accept={ACCEPTED_TYPES}
                    hidden 
                  />
                   {rubricFile ? (
                    <div className="file-preview horizontal">
                      {renderFilePreview(rubricFile, rubricPreview, true)}
                      <div className="file-info">
                        <span className="filename">{rubricFile.name}</span>
                        <span className="change-link">Click to change</span>
                      </div>
                    </div>
                  ) : (
                    <div className="upload-placeholder">
                      <span className="icon-small">🗝️</span>
                      <p>Drag & Drop Rubric/Key<br/><small>(Image, HEIC, or PDF)</small></p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <button 
            className={`grade-button ${isLoading ? 'loading' : ''}`} 
            onClick={handleGrade}
            disabled={isLoading || !isReady}
          >
            {isLoading ? "Grading..." : "Start Grading"}
          </button>
          
          {error && <div className="error-message">{error}</div>}
        </section>

        {/* --- Right Column: Output --- */}
        <section className="output-section">
          {isLoading ? (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Reading handwriting...</p>
              <p className="sub-text">Thinking and grading with {MODELS.find(m => m.id === model)?.name.split('(')[0]}...</p>
            </div>
          ) : result ? (
            <div className="result-card fade-in">
              <div className="result-header">
                <div>
                  <h3>Grading Report</h3>
                  <span className="student-name">{result.studentName}</span>
                </div>
                <div className="score-badge">
                  <span className="score">{result.totalScore}</span>
                  <span className="max-score">/ {result.maxScore}</span>
                </div>
              </div>

              <div className="result-block">
                <h4>Feedback</h4>
                <p className="feedback-text">{result.feedback}</p>
              </div>

              <div className="result-block">
                <h4>Score Breakdown</h4>
                <table className="breakdown-table">
                  <thead>
                    <tr>
                      <th>Criteria</th>
                      <th>Points</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.scoreBreakdown.map((item, idx) => (
                      <tr key={idx}>
                        <td>{item.description}</td>
                        <td className="points-cell">
                          <span className={item.pointsAwarded > 0 ? "points-good" : "points-bad"}>
                            {item.pointsAwarded}
                          </span>
                          <span className="points-divider">/</span>
                          <span>{item.maxPoints}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="result-block collapsible">
                <details>
                  <summary>View Transcribed Text</summary>
                  <p className="ocr-text">{result.recognizedText}</p>
                </details>
              </div>
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-icon">📊</div>
              <h3>Ready to Grade</h3>
              <p>Upload the student's work and the rubric to generate a report.</p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}