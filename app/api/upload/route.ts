import { NextRequest, NextResponse } from 'next/server';
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

type MessageCreateParams = {
  role: 'user';
  content: string;
  attachments: Array<{
    file_id: string;
    tools: Array<{ type: 'file_search' }>;
  }>;
};

export async function POST(request: NextRequest) {
  try {
    if (!process.env.OPENAI_ASSISTANT_ID) {
      throw new Error('OPENAI_ASSISTANT_ID environment variable is not set');
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Upload the file
    const openai = getOpenAI();
    const uploadedFile = await openai.files.create({
      file: file,
      purpose: 'assistants',
    });

    // Create a thread
    const thread = await openai.beta.threads.create();

    // Add the file to the thread
    await openai.beta.threads.messages.create(thread.id, {
      role: "user",
      content: "Please anonymize this resume by removing personal information while preserving professional details.",
      attachments: [{ 
        file_id: uploadedFile.id,
        tools: [{ type: "file_search" }]
      }]
    } as MessageCreateParams);

    // Run the assistant
    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: process.env.OPENAI_ASSISTANT_ID
    });

    // Wait for the run to complete
    let runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
    while (runStatus.status === 'queued' || runStatus.status === 'in_progress') {
      await new Promise(resolve => setTimeout(resolve, 1000));
      runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
    }

    if (runStatus.status !== 'completed') {
      throw new Error(`Run failed with status: ${runStatus.status}`);
    }

    // Get the assistant's response
    const messages = await openai.beta.threads.messages.list(thread.id);
    const assistantMessage = messages.data.find(m => m.role === 'assistant');
    
    if (!assistantMessage) {
      throw new Error('No response from assistant');
    }

    const content = assistantMessage.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from assistant');
    }

    return NextResponse.json({ 
      text: content.text.value 
    });
  } catch (error) {
    console.error('Error processing file:', error);
    return NextResponse.json(
      { error: 'Failed to process the file' },
      { status: 500 }
    );
  }
} 