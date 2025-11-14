
// A part of a multimodal prompt
interface GenerativePart {
    inlineData: {
        mimeType: string;
        data: string;
    };
}

/**
 * Converts a File object to a GoogleGenerativeAI.Part object.
 * @param file The file to convert.
 * @returns A promise that resolves to the Part object.
 */
export function fileToGenerativePart(file: File): Promise<GenerativePart> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            if (typeof reader.result !== 'string') {
                return reject(new Error("Failed to read file as data URL."));
            }
            const dataUrl = reader.result;
            // The result is a data URL: "data:mime/type;base64,the-base64-string"
            // We need to extract the mimeType and the base64 data.
            const base64Data = dataUrl.split(',')[1];
            if (!base64Data) {
                return reject(new Error("Invalid data URL format."));
            }
            resolve({
                inlineData: {
                    mimeType: file.type,
                    data: base64Data
                }
            });
        };
        reader.onerror = (error) => {
            reject(error);
        };
        reader.readAsDataURL(file);
    });
}
