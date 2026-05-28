import OpenAI from "openai";
import { logger } from "./logger";

const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY;
const AI_MODEL = process.env.AI_MODEL ?? "nvidia/gemma-3n-e2b-it";

function getClient(): OpenAI {
  if (!NVIDIA_API_KEY) {
    throw new Error("NVIDIA_API_KEY is not set. AI features are unavailable.");
  }
  return new OpenAI({
    apiKey: NVIDIA_API_KEY,
    baseURL: "https://integrate.api.nvidia.com/v1",
  });
}

async function chat(systemPrompt: string, userMessage: string): Promise<string> {
  const client = getClient();
  const completion = await client.chat.completions.create({
    model: AI_MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
    temperature: 0.3,
    max_tokens: 4096,
  });
  return completion.choices[0]?.message?.content ?? "";
}

export async function debugCode(code: string, error: string, language: string): Promise<string> {
  const system = `You are an expert ${language} developer. Debug code and explain the issue concisely. Return a JSON object: { "explanation": string, "fixedCode": string, "changes": string[] }`;
  const user = `Language: ${language}\n\nError:\n${error}\n\nCode:\n\`\`\`${language}\n${code}\n\`\`\``;
  try {
    return await chat(system, user);
  } catch (err) {
    logger.error({ err }, "AI debug failed");
    throw err;
  }
}

export async function generateCode(description: string, language: string, filename: string): Promise<string> {
  const system = `You are an expert ${language} developer. Generate clean, production-ready code. Return a JSON object: { "code": string, "explanation": string }`;
  const user = `Generate a ${language} file named "${filename}" that does: ${description}`;
  try {
    return await chat(system, user);
  } catch (err) {
    logger.error({ err }, "AI generate failed");
    throw err;
  }
}

export async function explainError(error: string, context: string): Promise<string> {
  const system = `You are a helpful developer assistant. Explain errors clearly and suggest fixes. Return a JSON object: { "explanation": string, "possibleCauses": string[], "suggestedFix": string }`;
  const user = `Error:\n${error}\n\nContext:\n${context}`;
  try {
    return await chat(system, user);
  } catch (err) {
    logger.error({ err }, "AI explain failed");
    throw err;
  }
}

export async function editCode(code: string, instruction: string, language: string): Promise<string> {
  const system = `You are an expert ${language} developer. Edit code based on instructions. Return a JSON object: { "editedCode": string, "changes": string[] }`;
  const user = `Language: ${language}\n\nInstruction: ${instruction}\n\nOriginal code:\n\`\`\`${language}\n${code}\n\`\`\``;
  try {
    return await chat(system, user);
  } catch (err) {
    logger.error({ err }, "AI edit failed");
    throw err;
  }
}

export async function addImports(code: string, language: string): Promise<string> {
  const system = `You are an expert ${language} developer. Analyze code and add missing imports/requires. Return a JSON object: { "updatedCode": string, "addedImports": string[] }`;
  const user = `Language: ${language}\n\nCode:\n\`\`\`${language}\n${code}\n\`\`\``;
  try {
    return await chat(system, user);
  } catch (err) {
    logger.error({ err }, "AI addImports failed");
    throw err;
  }
}

export async function generateTemplate(projectType: string, projectName: string): Promise<string> {
  const system = `You are an expert developer. Generate project templates. Return a JSON object: { "files": Array<{ "filename": string, "content": string }>, "instructions": string }`;
  const user = `Generate a starter template for a ${projectType} project named "${projectName}". Include all necessary files (package.json, index file, etc.).`;
  try {
    return await chat(system, user);
  } catch (err) {
    logger.error({ err }, "AI generateTemplate failed");
    throw err;
  }
}
