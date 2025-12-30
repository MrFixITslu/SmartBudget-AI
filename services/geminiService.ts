
import { GoogleGenAI, Type } from "@google/genai";
import { AIAnalysisResult, CATEGORIES } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    amount: { type: Type.NUMBER, description: "The total numerical value of the transaction" },
    category: { type: Type.STRING, description: `One of: ${CATEGORIES.join(', ')}` },
    description: { type: Type.STRING, description: "A summary description of the purchase" },
    type: { type: Type.STRING, description: "Either 'expense' or 'income'" },
    date: { type: Type.STRING, description: "ISO date if found (YYYY-MM-DD), otherwise omit" },
    vendor: { type: Type.STRING, description: "The name of the merchant, store, or company" },
    lineItems: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: "Name of the item" },
          price: { type: Type.NUMBER, description: "Price of the individual item" }
        },
        required: ["name", "price"]
      },
      description: "List of individual items found on the receipt"
    }
  },
  required: ["amount", "category", "description", "type"]
};

export const parseInputToTransaction = async (
  input: string | { data: string; mimeType: string },
  isMedia: boolean = false
): Promise<AIAnalysisResult | null> => {
  try {
    const contents = isMedia 
      ? { parts: [{ inlineData: input as { data: string; mimeType: string } }, { text: "Extract transaction details from this receipt image or audio. Identify the vendor (store name), the total amount, category, and list individual line items if visible." }] }
      : `Parse the following spending/income statement into a structured format: "${input}". Use the provided categories. Identify the vendor if possible.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: contents as any,
      config: {
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
        systemInstruction: "You are a professional financial assistant specialized in receipt OCR and transaction parsing. Extract vendor names, total amounts, and line items. If a receipt has multiple items, list them in lineItems. Categorize precisely. For audio, listen for amounts and descriptions. If a year is missing, assume the current year."
      }
    });

    const result = JSON.parse(response.text);
    return result as AIAnalysisResult;
  } catch (error) {
    console.error("Gemini Parsing Error:", error);
    return null;
  }
};
