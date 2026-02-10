
import { GoogleGenAI, Type } from "@google/genai";
import { AIAnalysisResult, CATEGORIES } from "../types";

const SCHEMA = {
  type: Type.OBJECT,
  properties: {
    updateType: { type: Type.STRING, enum: ['transaction', 'portfolio'], description: "Determine if this is a spending/earning event or a statement of current holdings (e.g., 'I have 0.5 BTC')." },
    transaction: {
      type: Type.OBJECT,
      properties: {
        amount: { type: Type.NUMBER },
        category: { type: Type.STRING },
        description: { type: Type.STRING },
        type: { type: Type.STRING, enum: ['expense', 'income', 'savings', 'withdrawal'] },
        date: { type: Type.STRING },
        vendor: { type: Type.STRING },
        lineItems: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              price: { type: Type.NUMBER },
              quantity: { type: Type.NUMBER }
            }
          }
        }
      }
    },
    portfolio: {
      type: Type.OBJECT,
      properties: {
        symbol: { type: Type.STRING, description: "Ticker symbol like BTC, ETH, or VOO." },
        quantity: { type: Type.NUMBER, description: "The total amount held." },
        provider: { type: Type.STRING, enum: ['Binance', 'Vanguard'], description: "The institution where the asset is held." }
      }
    }
  },
  required: ["updateType"]
};

export const parseInputToTransaction = async (
  input: string | { data: string; mimeType: string },
  isMedia: boolean = false
): Promise<AIAnalysisResult | null> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
    const contents = isMedia 
      ? { parts: [{ inlineData: input as { data: string; mimeType: string } }, { text: "Parse this receipt or audio note. If it's a balance statement (e.g. 'Binance shows 1 BTC'), use portfolio update. Otherwise, use transaction." }] }
      : { parts: [{ text: `Analyze: "${input}". Extract details.` }] };

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: contents,
      config: {
        responseMimeType: "application/json",
        responseSchema: SCHEMA,
        systemInstruction: "You are a financial parsing engine. Categorize transactions into: " + CATEGORIES.join(", ") + ". Be precise with merchant names and quantities."
      }
    });

    const text = response.text;
    return text ? JSON.parse(text) : null;
  } catch (error) {
    console.error("Gemini Error:", error);
    return null;
  }
};

export const parseStatementToTransactions = async (
  fileData: { data: string; mimeType: string }
): Promise<AIAnalysisResult[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: { 
        parts: [
          { inlineData: fileData }, 
          { text: "Extract every transaction from this bank statement." }
        ] 
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: SCHEMA
        }
      }
    });

    const text = response.text;
    return text ? JSON.parse(text) : [];
  } catch (error) {
    console.error("Statement Parsing Error:", error);
    return [];
  }
};
