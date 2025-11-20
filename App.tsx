import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
// @ts-ignore
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import { GradingResult } from './types';

// Configure PDF.js worker
GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@4.8.69/build/pdf.worker.min.mjs`;

const DEFAULT_QUESTION = "";
const DEFAULT_RUBRIC_TEXT = "";

// Provider types
type Provider = 'google' | 'alibaba';

interface ModelOption {
  id: string;
  name: string;
  provider: Provider;
}

const MODELS: ModelOption[] = [
  { id: 'gemini-3-pro-preview', name: 'Gemini 3.0 Pro (Google - Best Reasoning)', provider: 'google' },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (Google - Fast)', provider: 'google' },
  { id: 'qwen-vl-max', name: 'Qwen-VL Max (Alibaba - Vision & Reasoning)', provider: 'alibaba' },
  { id: 'qwen-vl-plus', name: 'Qwen-VL Plus (Alibaba - Balanced)', provider: 'alibaba' },
];

const ACCEPTED_TYPES = "image/*,application/pdf,.heic,.HEIC";
const MAX_FILE_SIZE_MB = 10; // Adjusted to 10MB to filter obviously huge files before processing

// --- Utilities ---

// Resize images to ensure payload fits within API browser proxy limits (~4MB)
const resizeImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        // Reduced to 1536px (Standard High-Res) to prevent Code 6 / Payload Too Large errors
        // 3072px was causing Base64 strings > 5MB which fail in XHR
        const MAX_DIMENSION = 1536;

        if (width > height) {
          if (width > MAX_DIMENSION) {
            height *= MAX_DIMENSION / width;
            width = MAX_DIMENSION;
          }
        } else {
          if (height > MAX_DIMENSION) {
            width *= MAX_DIMENSION / height;
            height = MAX_DIMENSION;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        // Compress to JPEG quality 0.7 for efficient transmission
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        resolve(dataUrl.split(',')[1]);
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

// Convert PDF pages to Array of Base64 Images (JPEG)
const convertPdfToImages = async (file: File): Promise<{ data: string; mimeType: string }[]> => {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await getDocument({ data: arrayBuffer }).promise;
  
  const images: { data: string; mimeType: string }[] = [];
  // Limit to first 5 pages to prevent payload explosion
  const maxPages = Math.min(pdf.numPages, 5);

  for (let i = 1; i <= maxPages; i++) {
    const page = await pdf.getPage(i);
    // Scale 1.5 offers good balance between readability and size
    const scale = 1.5; 
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    if (context) {
      // Casting to any to resolve 'missing canvas' property error in strict TS environments
      // where pdfjs-dist types might require the canvas element in RenderParameters
      await page.render({ canvasContext: context, viewport: viewport } as any).promise;
      // 0.7 quality to keep each page ~200-400KB
      const base64 = canvas.toDataURL('image/jpeg', 0.7).split(',')[1];
      images.push({ data: base64, mimeType: 'image/jpeg' });
    }
  }
  return images;
};

export default function App() {
  // --- State ---
  const [selectedModelId, setSelectedModelId] = useState<string>(MODELS[0].id);
  const [qwenApiKey, setQwenApiKey] = useState<string>("");

  const currentModel = MODELS.find(m => m.id === selectedModelId) || MODELS[0];

  // 1. Student Response
  const [studentMode, setStudentMode] = useState<'text' | 'file'>('file');
  const [studentText, setStudentText] = useState<string>("");
  const [studentFile, setStudentFile] = useState<File | null>(null);
  const [studentPreview, setStudentPreview] = useState<string | null>(null);
  const [isDraggingStudent, setIsDraggingStudent] = useState(false);

  // 2. Question Context
  const [question, setQuestion] = useState<string>(DEFAULT_QUESTION);

  // 3. Rubric
  const [rubricMode, setRubricMode] = useState<'text' | 'file'>('text');
  const [rubricText, setRubricText] = useState<string>(DEFAULT_RUBRIC_TEXT);
  const [rubricFile, setRubricFile] = useState<File | null>(null);
  const [rubricPreview, setRubricPreview] = useState<string | null>(null);
  const [isDraggingRubric, setIsDraggingRubric] = useState(false);
  
  // 4. App State
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<GradingResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const studentInputRef = useRef<HTMLInputElement>(null);
  const rubricInputRef = useRef<HTMLInputElement>(null);

  // --- Helpers ---

  const processFile = (
    file: File | undefined, 
    setFile: (f: File) => void, 
    setPreview: (s: string | null) => void
  ) => {
    if (!file) return;

    const isHeic = file.name.toLowerCase().endsWith('.heic');
    const isPdf = file.type === 'application/pdf';
    const isStandardImage = file.type.startsWith('image/') && !isHeic;
    
    const isValidType = isStandardImage || isPdf || isHeic;

    if (!isValidType) {
      setError("Unsupported file type. Please upload an Image, PDF, or HEIC file.");
      return;
    }

    if ((isPdf || isHeic) && file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setError(`File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Please use a file smaller than ${MAX_FILE_SIZE_MB}MB or convert to JPG/PNG.`);
      return;
    }

    setFile(file);
    setResult(null);
    setError(null);

    if (isStandardImage) {
      const reader = new FileReader();
      reader.onloadend = () => setPreview(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      setPreview(null); 
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, setFile: any, setPreview: any) => {
    processFile(e.target.files?.[0], setFile, setPreview);
  };

  // Drag & Drop
  const handleDragOver = (e: React.DragEvent, setIsDragging: any) => {
    e.preventDefault(); e.stopPropagation(); setIsDragging(true);
  };
  const handleDragLeave = (e: React.DragEvent, setIsDragging: any) => {
    e.preventDefault(); e.stopPropagation(); setIsDragging(false);
  };
  const handleDrop = (e: React.DragEvent, setIsDragging: any, setFile: any, setPreview: any) => {
    e.preventDefault(); e.stopPropagation(); setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) processFile(files[0], setFile, setPreview);
  };

  // Intelligent File Processing Logic
  const prepareFileForAI = async (file: File): Promise<{ data: string; mimeType: string }[]> => {
    const isPdf = file.type === 'application/pdf';
    const isHeic = file.name.toLowerCase().endsWith('.heic');

    // Strategy 1: PDF Processing
    // For Qwen: Must always convert PDF to images (API limitation).
    // For Gemini: If PDF is large (> 3MB), convert to images to allow resizing and prevent "Rpc failed" (Code 6) errors.
    if (isPdf) {
      if (currentModel.provider === 'alibaba' || file.size > 3 * 1024 * 1024) {
        try {
          console.log("Converting PDF to images for transmission...");
          return await convertPdfToImages(file);
        } catch (e) {
          console.error("PDF conversion failed", e);
          // If it was Gemini and conversion failed, we might try raw as last resort if it's not absolutely huge
          if (currentModel.provider === 'google' && file.size < 5 * 1024 * 1024) {
             console.warn("Falling back to raw PDF upload for Gemini");
             // Fall through to Strategy 3
          } else {
             throw new Error("Failed to process PDF. Please upload JPG/PNG images directly.");
          }
        }
      }
    }

    // Strategy 2: Standard Images (Resize if needed)
    if (file.type.match(/image\/(jpeg|png|webp)/)) {
      // Optimization: If file is small (< 2MB), send raw to preserve maximum quality
      if (file.size < 2 * 1024 * 1024) {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            if (typeof reader.result === 'string') {
              resolve([{ data: reader.result.split(',')[1], mimeType: file.type }]);
            } else reject(new Error("Read error"));
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      }

      // Otherwise, resize to manageable dimensions
      try {
        const b64 = await resizeImage(file);
        return [{ data: b64, mimeType: 'image/jpeg' }];
      } catch (e) {
        console.warn("Resize failed, using raw", e);
      }
    }

    // Strategy 3: Raw Read (Small PDF, HEIC, or fallback)
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
         if (typeof reader.result === 'string') {
             let mimeType = file.type;
             if (isHeic) mimeType = 'image/heic';
             resolve([{ 
               data: reader.result.split(',')[1],
               mimeType: mimeType
             }]);
         } else { reject(new Error("Read error")); }
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // --- Core Grading Logic ---

  const getPromptsAndContext = async () => {
    const images: { data: string; mimeType: string }[] = [];
    let studentContentPrompt = "";
    let rubricContentPrompt = "";

    // 1. Student Response
    if (studentMode === 'file' && studentFile) {
      const parts = await prepareFileForAI(studentFile);
      images.push(...parts);
      studentContentPrompt = "(See attached Student Response images)";
    } else {
      studentContentPrompt = studentText;
    }

    // 2. Rubric
    if (rubricMode === 'file' && rubricFile) {
       const parts = await prepareFileForAI(rubricFile);
       images.push(...parts);
       rubricContentPrompt = "Refer to the attached Rubric/Key images.";
    } else {
       rubricContentPrompt = rubricText;
    }

    const systemPrompt = `
# AP FRQ Auto-Grader Persona
**Role:** Strict, objective AP Exam Reader.
**Mission:** Grade student responses against a specific Scoring Guideline (Rubric) with zero bias.
**Operational Rules:**
1. **Literal Keyword Matching:** Points awarded ONLY if required concepts are explicitly stated.
2. **Task Verbs:** "Identify" needs no explanation. "Explain" requires logical linkage.
3. **Contradiction Penalty:** Correct answer + wrong reasoning = 0 points.
4. **Binary Scoring:** Unless specified otherwise, score is 0 or 1.
5. **Evidence:** Cite specific Rubric phrases for every decision.
**Task:** Evaluate the "Student Response" based strictly on the "Scoring Guidelines" for the "Question".
`;
    const userPrompt = `
**Input Data:**
* **[Question Prompt]:** "${question}"
* **[Scoring Guidelines]:** "${rubricContentPrompt}"
* **[Student Response]:** ${studentContentPrompt}

**Output Requirement:**
Output strict JSON matching this schema:
{
  "studentName": "string",
  "recognizedText": "string (transcription)",
  "feedback": "string (critical feedback)",
  "totalScore": number,
  "maxScore": number,
  "scoreBreakdown": [
    { "description": "string (Analysis)", "pointsAwarded": number, "maxPoints": number }
  ]
}
`;
    return { systemPrompt, userPrompt, images };
  };

  const gradeWithGemini = async () => {
    const { systemPrompt, userPrompt, images } = await getPromptsAndContext();
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const parts: any[] = [];
    images.forEach(img => {
      parts.push({ inlineData: { data: img.data, mimeType: img.mimeType } });
    });
    parts.push({ text: userPrompt });

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        studentName: { type: Type.STRING },
        recognizedText: { type: Type.STRING },
        feedback: { type: Type.STRING },
        totalScore: { type: Type.NUMBER },
        maxScore: { type: Type.NUMBER },
        scoreBreakdown: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              description: { type: Type.STRING },
              pointsAwarded: { type: Type.NUMBER },
              maxPoints: { type: Type.NUMBER },
            },
            required: ["description", "pointsAwarded", "maxPoints"],
          },
        },
      },
      required: ["studentName", "recognizedText", "feedback", "totalScore", "maxScore", "scoreBreakdown"],
    };

    const response = await ai.models.generateContent({
      model: currentModel.id,
      contents: { parts },
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        thinkingConfig: { thinkingBudget: 1024 },
      },
    });
    return response.text;
  };

  const gradeWithQwen = async () => {
    if (!qwenApiKey) throw new Error("Please enter your Alibaba DashScope API Key.");
    
    const { systemPrompt, userPrompt, images } = await getPromptsAndContext();

    // Validate for Qwen (No raw PDF allowed)
    const invalidImage = images.find(img => img.mimeType === 'application/pdf');
    if (invalidImage) throw new Error("PDF Conversion failed. Qwen cannot process raw PDF files.");

    const messages: any[] = [{ role: "system", content: systemPrompt }];
    const userContent: any[] = [{ type: "text", text: userPrompt }];
    
    images.forEach(img => {
      userContent.push({
        type: "image_url",
        image_url: { url: `data:${img.mimeType};base64,${img.data}` }
      });
    });

    messages.push({ role: "user", content: userContent });

    const response = await fetch("https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${qwenApiKey}`
      },
      body: JSON.stringify({
        model: currentModel.id,
        messages: messages,
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      console.error(err);
      throw new Error(`Qwen API Error: ${err.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  };

  const handleGrade = async () => {
    if (studentMode === 'file' && !studentFile) return setError("Please upload the student's answer file.");
    if (studentMode === 'text' && !studentText.trim()) return setError("Please enter the student's answer text.");
    if (!question.trim()) return setError("Please enter the Question Prompt.");
    if (rubricMode === 'text' && !rubricText.trim()) return setError("Please enter the rubric text.");
    if (rubricMode === 'file' && !rubricFile) return setError("Please upload the rubric file.");

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      let jsonText: string | undefined;
      if (currentModel.provider === 'google') {
        jsonText = await gradeWithGemini();
      } else {
        jsonText = await gradeWithQwen();
      }

      if (jsonText) {
        jsonText = jsonText.replace(/^```json\s*/, "").replace(/\s*```$/, "");
        const parsedResult = JSON.parse(jsonText) as GradingResult;
        setResult(parsedResult);
      } else {
        throw new Error("No response received from AI.");
      }
    } catch (err: any) {
      console.error(err);
      let msg = err.message || "An error occurred.";
      if (msg.includes("500") || msg.includes("Rpc failed") || msg.includes("xhr error")) {
        msg = `Network Error: The file payload is too large for the browser proxy. Resizing logic has been applied, but please try a simpler image if this persists.`;
      }
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  // UI Helpers
  const renderFilePreview = (file: File, preview: string | null, isSmall = false) => {
    const isHeic = file.name.toLowerCase().endsWith('.heic');
    const isPdf = file.type === 'application/pdf';
    
    const pdfBadge = isPdf ? <div className="file-badge">PDF</div> : null;

    if (file.type.startsWith('image/') && !isHeic && preview) {
      return <div className="preview-wrapper"><img src={preview} className={isSmall?"thumb":""}/></div>;
    }
    
    const label = isHeic ? "HEIC" : "PDF";
    const iconClass = isSmall ? "pdf-icon-small" : "pdf-icon-box"; 
    if (isSmall) return <div className={iconClass}>{label}</div>;
    
    return (
      <div className="pdf-icon">
        <span style={{ fontSize: '4rem' }}>📄</span>
        <p>{file.name}</p>
        {pdfBadge}
      </div>
    );
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>Siamese <span>AI Grader</span></h1>
        <p>Upload answers and rubrics to grade instantly.</p>
        <div className="model-selector-wrapper">
          <div className="model-selector-container">
            <label>Model:</label>
            <select value={selectedModelId} onChange={(e) => setSelectedModelId(e.target.value)} className="model-select">
              {MODELS.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          {currentModel.provider === 'alibaba' && (
             <div className="api-key-input-container fade-in">
               <input type="password" placeholder="Enter DashScope API Key (sk-...)" value={qwenApiKey} onChange={(e) => setQwenApiKey(e.target.value)} className="api-key-input" />
             </div>
          )}
        </div>
      </header>

      <main className="main-content">
        <section className="input-section">
          <div className="card input-card">
            <h2>1. Student Response</h2>
            <div className="form-group">
              <div className="label-row">
                <label>Input Format</label>
                <div className="toggle-switch">
                  <button className={studentMode==='file'?'active':''} onClick={()=>setStudentMode('file')}>File</button>
                  <button className={studentMode==='text'?'active':''} onClick={()=>setStudentMode('text')}>Text</button>
                </div>
              </div>
              {studentMode === 'text' ? (
                <textarea value={studentText} onChange={(e) => setStudentText(e.target.value)} placeholder="Paste answer..." rows={6} />
              ) : (
                <div className={`drop-zone ${studentFile?'has-file':''} ${isDraggingStudent?'drag-active':''}`} onClick={()=>studentInputRef.current?.click()} onDragOver={(e)=>handleDragOver(e,setIsDraggingStudent)} onDragLeave={(e)=>handleDragLeave(e,setIsDraggingStudent)} onDrop={(e)=>handleDrop(e,setIsDraggingStudent,setStudentFile,setStudentPreview)}>
                  <input type="file" ref={studentInputRef} onChange={(e)=>handleFileUpload(e,setStudentFile,setStudentPreview)} accept={ACCEPTED_TYPES} hidden />
                  {studentFile ? (
                    <div className="file-preview">
                      {renderFilePreview(studentFile, studentPreview)}
                      <button className="change-file-btn" onClick={(e)=>{e.stopPropagation();studentInputRef.current?.click();}}>Change File</button>
                    </div>
                  ) : (
                    <div className="upload-placeholder"><span className="icon">📄</span><p>Drag & Drop Answer</p></div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="card input-card">
            <h2>2. Question & Rubric</h2>
            <div className="form-group">
              <label>Question Prompt</label>
              <textarea value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Enter question..." rows={3} />
            </div>
            <div className="form-group">
              <div className="label-row">
                <label>Rubric / Answer Key</label>
                <div className="toggle-switch">
                  <button className={rubricMode==='text'?'active':''} onClick={()=>setRubricMode('text')}>Text</button>
                  <button className={rubricMode==='file'?'active':''} onClick={()=>setRubricMode('file')}>File</button>
                </div>
              </div>
              {rubricMode === 'text' ? (
                <textarea value={rubricText} onChange={(e) => setRubricText(e.target.value)} placeholder="Enter criteria..." rows={6} />
              ) : (
                <div className={`drop-zone small-drop-zone ${rubricFile?'has-file':''} ${isDraggingRubric?'drag-active':''}`} onClick={()=>rubricInputRef.current?.click()} onDragOver={(e)=>handleDragOver(e,setIsDraggingRubric)} onDragLeave={(e)=>handleDragLeave(e,setIsDraggingRubric)} onDrop={(e)=>handleDrop(e,setIsDraggingRubric,setRubricFile,setRubricPreview)}>
                  <input type="file" ref={rubricInputRef} onChange={(e)=>handleFileUpload(e,setRubricFile,setRubricPreview)} accept={ACCEPTED_TYPES} hidden />
                  {rubricFile ? (
                    <div className="file-preview horizontal">
                      {renderFilePreview(rubricFile, rubricPreview, true)}
                      <div className="file-info"><span className="filename">{rubricFile.name}</span><span className="change-link">Change</span></div>
                    </div>
                  ) : <div className="upload-placeholder"><span className="icon-small">🗝️</span><p>Drag & Drop Rubric</p></div>}
                </div>
              )}
            </div>
          </div>

          <button className={`grade-button ${isLoading?'loading':''}`} onClick={handleGrade} disabled={isLoading}>
            {isLoading ? "Grading..." : "Start Grading"}
          </button>
          {error && <div className="error-message">{error}</div>}
        </section>

        <section className="output-section">
          {isLoading ? (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Analyzing...</p>
              <p className="sub-text">Using {currentModel.name.split('(')[0]}...</p>
            </div>
          ) : result ? (
            <div className="result-card fade-in">
              <div className="result-header">
                <div><h3>Grading Report</h3><span className="student-name">{result.studentName}</span></div>
                <div className="score-badge"><span className="score">{result.totalScore}</span><span className="max-score">/ {result.maxScore}</span></div>
              </div>
              <div className="result-block"><h4>Feedback</h4><p className="feedback-text">{result.feedback}</p></div>
              <div className="result-block">
                <h4>Score Breakdown</h4>
                <table className="breakdown-table">
                  <thead><tr><th>Criteria</th><th>Points</th></tr></thead>
                  <tbody>
                    {result.scoreBreakdown.map((item, idx) => (
                      <tr key={idx}><td>{item.description}</td><td className="points-cell"><span className={item.pointsAwarded>0?"points-good":"points-bad"}>{item.pointsAwarded}</span><span className="points-divider">/</span><span>{item.maxPoints}</span></td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="result-block collapsible">
                <details><summary>View Transcribed Text</summary><p className="ocr-text">{result.recognizedText}</p></details>
              </div>
            </div>
          ) : (
            <div className="empty-state"><div className="empty-icon">📊</div><h3>Ready to Grade</h3><p>Upload work and rubric to generate report.</p></div>
          )}
        </section>
      </main>
    </div>
  );
}