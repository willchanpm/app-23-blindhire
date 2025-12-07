import { NextRequest, NextResponse } from 'next/server';
import { Candidate } from '../../types/candidate';
import { OpenAI } from 'openai';

// Lazy initialization: only create the client when the API route is called
// This prevents build-time errors when OPENAI_API_KEY is not set
function getOpenAI(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is not set');
  }
  return new OpenAI({ apiKey });
}

export async function POST(request: NextRequest) {
  try {
    const { text, jobId } = await request.json();

    if (!text || !jobId) {
      return NextResponse.json(
        { error: 'Text and job ID are required' },
        { status: 400 }
      );
    }

    // Send the text to GPT for scrubbing
    const scrubbedText = await scrubWithGPT(text);

    // Create a new candidate with scrubbed text
    const candidate: Candidate = {
      id: (Math.floor(100000 + Math.random() * 900000)).toString(),
      jobId,
      scrubbedText,
      originalText: text,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Return the candidate for client-side storage
    return NextResponse.json({ candidate });
  } catch (error) {
    console.error('Error processing file:', error);
    return NextResponse.json(
      { error: 'Failed to process the file' },
      { status: 500 }
    );
  }
}

async function scrubWithGPT(text: string): Promise<string> {
  const prompt = `You are a resume anonymization assistant. Your task is to remove all personal identifying information from the following text while preserving professional experience and skills. Specifically:

1. Remove or replace:
   - Names (first, last, full)
   - Email addresses
   - Phone numbers
   - Physical addresses
   - Social media handles
   - Personal websites
   - Age, gender, or other demographic information
   - Photos or image references
   - References to specific schools, universities, or educational institutions
   - References to specific companies or organizations
   - Dates (years can be kept but specific dates should be removed)

2. Preserve:
   - Professional skills and qualifications
   - Job titles and roles
   - Years of experience
   - Technical skills and tools
   - Project descriptions
   - Achievements and accomplishments
   - Industry-specific terminology

3. Format:
   - Return only the scrubbed text
   - Do not include any explanations or metadata
   - Maintain the original structure and formatting where possible
   - Use placeholders like [COMPANY], [UNIVERSITY], etc. for removed information

Here is the text to process:
${text}`;

  const openai = getOpenAI();
  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      {
        role: "system",
        content: "You are a professional resume anonymization assistant that removes personal information while preserving professional details."
      },
      {
        role: "user",
        content: prompt
      }
    ],
    temperature: 0.3,
    max_tokens: 2000
  });

  return response.choices[0].message.content || text;
} 