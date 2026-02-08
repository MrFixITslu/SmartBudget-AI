
import { GoogleGenAI, Type } from "@google/genai";
import { InstitutionType, Transaction, AIAnalysisResult } from "../types";

/**
 * Since many regional banks don't have public REST APIs,
 * this service acts as an "Intelligent Gateway" that mimics API behavior
 * using Gemini to parse document-based data or simulate live feeds.
 */
// Changed return type to Promise<any[]> because the schema generates a list of raw transaction objects
export const syncBankData = async (
  institution: string,
  lastSynced?: string
): Promise<any[]> => {
  // If the user hasn't synced before, we don't force simulated data anymore.
  // We strictly wait for user interaction or actual document uploads.
  if (!lastSynced) return [];

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  // Simulating a network delay for API call
  await new Promise(resolve => setTimeout(resolve, 2000));

  try {
    const isCreditUnion = institution.toLowerCase().includes('credit union');
    const specificContext = isCreditUnion 
      ? `This is a Credit Union institution (${institution}). Include entries like 'Member Dividends', 'Loan Repayment', 'Share Contribution', or 'Co-op Purchase'.`
      : `This is a standard commercial bank (${institution}).`;

    const prompt = `
      Simulate a JSON API response for ${institution}. 
      The last sync was ${lastSynced}.
      ${specificContext}
      Generate a list of 2-3 realistic recent transactions that might have occurred since the last sync.
      Include categories like 'Food', 'Transport', 'Shopping', 'Savings'.
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

    // Return the array directly as specified by the responseSchema
    return JSON.parse(response.text);
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
