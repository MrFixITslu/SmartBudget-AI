
import { GoogleGenAI, Type } from "@google/genai";
import { AIAnalysisResult, CATEGORIES } from "../types";

const SINGLE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    amount: { type: Type.NUMBER, description: "Total amount of the transaction." },
    category: { type: Type.STRING, description: "One of the standard budget categories." },
    description: { type: Type.STRING, description: "A brief summary of the purchase." },
    type: { type: Type.STRING, description: "Either 'income' or 'expense'." },
    date: { type: Type.STRING, description: "Transaction date in YYYY-MM-DD format." },
    vendor: { type: Type.STRING, description: "The official name of the merchant or vendor." },
    lineItems: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: "The name of the individual item purchased." },
          price: { type: Type.NUMBER, description: "The unit price or total line price." },
          quantity: { type: Type.NUMBER, description: "Number of units purchased (if visible)." }
        },
        required: ["name", "price"]
      },
      description: "List of individual items found on the receipt."
    }
  },
  required: ["amount", "category", "description", "type"]
};

const BULK_SCHEMA = {
  type: Type.ARRAY,
  items: SINGLE_SCHEMA
};

export const parseInputToTransaction = async (
  input: string | { data: string; mimeType: string },
  isMedia: boolean = false
): Promise<AIAnalysisResult | null> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const contents = isMedia 
      ? { parts: [{ inlineData: input as { data: string; mimeType: string } }, { text: "Extract transaction details with high precision. Identify the merchant/vendor name clearly. List every item found on the receipt with its name, price, and quantity. If it's a single receipt, return one object representing the entire purchase." }] }
      : `Parse this into a structured transaction: "${input}". Be detailed about what was bought.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: contents as any,
      config: {
        responseMimeType: "application/json",
        responseSchema: SINGLE_SCHEMA,
        systemInstruction: "You are an elite financial OCR and data extraction expert. Your goal is to provide granular details from receipts and text logs. Identify the vendor/merchant name accurately. For line items, extract the name, unit or line price, and quantity. Categorize the transaction into one of these: " + CATEGORIES.join(", ") + ". Use current year if missing."
      }
    });

    return JSON.parse(response.text) as AIAnalysisResult;
  } catch (error) {
    console.error("Gemini Parsing Error:", error);
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
          { text: "This is a bank statement. Extract EVERY individual transaction line. Look for vendor names, dates, and amounts. Differentiate between debits (expenses) and credits (income)." }
        ] 
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: BULK_SCHEMA,
        systemInstruction: "You are a specialized bank statement parser. Extract Date, Description (Vendor), and Amount for every line. Identify transaction types (income vs expense). Return a clean JSON array of objects."
      }
    });

    return JSON.parse(response.text) as AIAnalysisResult[];
  } catch (error) {
    console.error("Bulk Parsing Error:", error);
    return [];
  }
};
