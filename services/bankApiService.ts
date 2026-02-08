
import { GoogleGenAI, Type } from "@google/genai";
import { InstitutionType, Transaction, AIAnalysisResult } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Since many regional banks (St. Lucia) don't have public REST APIs,
 * this service acts as an "Intelligent Gateway" that mimics API behavior
 * using Gemini to parse document-based data or simulate live feeds.
 */
export const syncBankData = async (
  institution: string,
  lastSynced?: string
): Promise<AIAnalysisResult[]> => {
  // Simulating a network delay for API call
  await new Promise(resolve => setTimeout(resolve, 2000));

  try {
    const isCreditUnion = institution.toLowerCase().includes('credit union');
    const specificContext = isCreditUnion 
      ? `This is a Credit Union institution (${institution}). Include entries like 'Member Dividends', 'Loan Repayment', 'Share Contribution', or 'Co-op Purchase'.`
      : `This is a standard commercial bank (${institution}).`;

    const prompt = `
      Simulate a JSON API response for ${institution}. 
      The last sync was ${lastSynced || 'never'}.
      ${specificContext}
      Generate a list of 3-5 realistic recent transactions for a user in St. Lucia.
      Use local currency format ($) but keep it as numbers.
      Include diverse categories like 'Food', 'Transport', 'Shopping', 'Savings'.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              amount: { type: Type.NUMBER },
              category: { type: Type.STRING },
              description: { type: Type.STRING },
              type: { type: Type.STRING, enum: ["expense", "income"] },
              date: { type: Type.STRING },
              vendor: { type: Type.STRING }
            },
            required: ["amount", "category", "description", "type", "date"]
          }
        }
      }
    });

    return JSON.parse(response.text) as AIAnalysisResult[];
  } catch (error) {
    console.error("Bank API Error:", error);
    return [];
  }
};

export const verifyApiConnection = async (credentials: any, institution: string): Promise<boolean> => {
  // Simulate API handshake logic
  return new Promise((resolve) => {
    setTimeout(() => resolve(true), 1500);
  });
};
