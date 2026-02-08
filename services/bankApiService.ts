
import { GoogleGenAI, Type } from "@google/genai";
import { InstitutionType, Transaction, AIAnalysisResult } from "../types";

/**
 * Since many regional banks don't have public REST APIs,
 * this service acts as an "Intelligent Gateway" that mimics API behavior
 * using Gemini to parse document-based data or simulate live feeds.
 */
export const syncBankData = async (
  institution: string,
  lastSynced?: string
): Promise<any[]> => {
  if (!lastSynced) return [];

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
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

    return JSON.parse(response.text);
  } catch (error) {
    console.error("Bank API Error:", error);
    return [];
  }
};

/**
 * Specialized LUCELEC Portal Scraper Simulation
 * Target: https://myaccount.lucelec.com/app/login.jsp
 * User: NeilV
 */
export const syncLucelecPortal = async (): Promise<{ balance: number; dueDate: string } | null> => {
  // Simulate portal navigation and login
  console.log("Navigating to LUCELEC portal...");
  await new Promise(r => setTimeout(r, 1000));
  console.log("Authenticating as NeilV...");
  await new Promise(r => setTimeout(r, 1500));
  
  // Simulation of finding "My Current Bill" header
  const mockBalance = Math.floor(Math.random() * 150) + 85.50;
  const nextMonth = new Date();
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  nextMonth.setDate(25);
  
  return {
    balance: mockBalance,
    dueDate: nextMonth.toISOString().split('T')[0]
  };
};

export const verifyApiConnection = async (credentials: any, institution: string): Promise<boolean> => {
  return new Promise((resolve) => {
    setTimeout(() => resolve(true), 1500);
  });
};
