# Siamese AI Grader

This is a modern React web application that uses **Google Gemini** to grade handwritten AP Free Response Questions (FRQs).

## Features

- **Model Selection**: Switch between **Gemini 3.0 Pro** (for deep reasoning) and **Gemini 2.5 Flash** (for speed) based on your needs.
- **Handwriting Recognition**: Instantly transcribes student handwriting from images using multimodal capabilities.
- **AI Grading**: Evaluates the answer against a specific rubric with Thinking Config enabled for reasoning.
- **Detailed Feedback**: Provides a total score, detailed rubric breakdown, and qualitative feedback.
- **File Support**: Upload Student Responses and Answer Keys as Images, HEIC files, or PDFs.
- **Privacy**: No backend required; runs entirely in the browser using the Gemini API.

## Setup

1.  **Install Dependencies:**
    ```bash
    npm install
    ```

2.  **API Key:**
    - Ensure you have a Google GenAI API Key.
    - The app expects `process.env.API_KEY` to be set in your build environment.

3.  **Run:**
    ```bash
    npm start
    ```

## Usage

1.  **Select Model**: Choose between Gemini 3 Pro or Gemini 2.5 Flash from the header dropdown.
2.  **Upload**: Drag and drop an image/PDF/HEIC of the handwritten student response.
3.  **Configure**: Enter the Question and upload or type the Grading Rubric.
4.  **Grade**: Click "Start Grading" and view the detailed report.