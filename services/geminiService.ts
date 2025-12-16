import { GoogleGenAI } from "@google/genai";
import { SYSTEM_PROMPT } from '../constants';
import { AnalysisMode } from '../types';

interface GenerateOptions {
  prompt: string;
  mode: AnalysisMode;
  apiKey: string;
}

const getModeInstruction = (mode: AnalysisMode): string => {
  switch (mode) {
    case AnalysisMode.LIGHT:
      return "Just answer";
    case AnalysisMode.MEDIUM:
      return "Quick take";
    case AnalysisMode.HEAVY:
      return "Run full process";
    case AnalysisMode.ADVERSARIAL:
      return "Switch to adversarial";
    default:
      return "Quick take";
  }
};

export const generateAnalysis = async ({ prompt, mode, apiKey }: GenerateOptions) => {
  const ai = new GoogleGenAI({ apiKey });
  
  const modeInstruction = getModeInstruction(mode);
  const fullPrompt = `User Command: ${modeInstruction}\n\nQuery: ${prompt}`;

  // Using gemini-3-pro-preview with high thinking budget as requested
  const model = "gemini-3-pro-preview";

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: fullPrompt,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        thinkingConfig: {
          thinkingBudget: 32768 // Max budget for pro model
        },
        // Explicitly NOT setting maxOutputTokens as per instructions
      }
    });

    return response.text;
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};
