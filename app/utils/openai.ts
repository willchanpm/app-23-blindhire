import { OpenAI } from 'openai';

// Lazy initialization: only create the client when actually needed
// This prevents build-time errors when OPENAI_API_KEY is not set
let openaiInstance: OpenAI | null = null;

export function getOpenAI(): OpenAI {
  if (!openaiInstance) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is not set');
    }
    openaiInstance = new OpenAI({ apiKey });
  }
  return openaiInstance;
}

export async function uploadFileToOpenAI(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch('/api/upload', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Failed to upload file: ${response.statusText}`);
  }

  const data = await response.json();
  return data.fileId;
} 