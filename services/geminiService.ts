
import { GoogleGenAI, Type } from "@google/genai";
import { ProcessedTransaction, AiSummary } from "../types";

export const getFinancialSummary = async (transactions: ProcessedTransaction[]): Promise<AiSummary | null> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // Sample first 50 transactions to keep context window reasonable and avoid token limits
    const sample = transactions.slice(0, 50).map(t => ({
      desc: t.Description,
      amt: t.Amount
    }));

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Analyze these financial transactions and provide a professional summary: ${JSON.stringify(sample)}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            overview: { type: Type.STRING, description: "A high-level summary of spending patterns." },
            topCategories: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  category: { type: Type.STRING },
                  amount: { type: Type.NUMBER }
                },
                required: ["category", "amount"]
              }
            },
            savingsAdvice: { type: Type.STRING, description: "Actionable advice to save money based on the data." }
          },
          required: ["overview", "topCategories", "savingsAdvice"]
        }
      }
    });

    const result = JSON.parse(response.text);
    return result as AiSummary;
  } catch (error) {
    console.error("AI Analysis failed:", error);
    return null;
  }
};
