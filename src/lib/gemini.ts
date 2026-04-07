import { GoogleGenAI } from "@google/genai";
import { STANDARD_POSITIONS } from "./fieldLogic";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function suggestField(prompt: string) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: prompt,
    });
    return response.text;
  } catch (e: any) {
    if (e.message?.includes("Failed to fetch")) {
      throw new Error("Network error: Failed to connect to Gemini API. Please check your internet connection or disable adblockers.");
    }
    throw e;
  }
}

export async function liveAnalysis(matchContext: any, ballHistory: any[]) {
  let powerplayNote = "";
  if (matchContext.powerplayConfig) {
    const over = matchContext.overs;
    const config = matchContext.powerplayConfig;
    let currentPP = "None";
    let maxOutfield = 9;

    if (over < config.p1.endOver) {
      currentPP = "P1";
      maxOutfield = config.p1.maxOutfield;
    } else if (over < config.p2.endOver) {
      currentPP = "P2";
      maxOutfield = config.p2.maxOutfield;
    } else if (over < config.p3.endOver) {
      currentPP = "P3";
      maxOutfield = config.p3.maxOutfield;
    }
    powerplayNote = `\nCRITICAL: Current Powerplay is ${currentPP}. You MUST NOT place more than ${maxOutfield} fielders in the outfield (where distance from center sqrt(x^2 + y^2) > 0.4). Ensure the field complies with these restrictions.`;
  }

  const prompt = `Act as a world-class cricket captain and tactical analyst. 
Analyze the current match situation and provide tactical suggestions and field changes.${powerplayNote}

Standard Fielding Positions (Reference for RHB):
${JSON.stringify(STANDARD_POSITIONS, null, 2)}

Match Context:
${JSON.stringify(matchContext, null, 2)}

Recent Ball History:
${JSON.stringify(ballHistory, null, 2)}

Provide the response in the following JSON format:
{
  "suggestions": [
    { "message": "The suggestion text", "type": "field-change" | "bowling" | "pressure" | "info", "priority": "high" | "medium" | "low" }
  ],
  "fielders": [
    { "name": "Position Name", "label": "Short Label", "x": float (-1 to 1), "y": float (-1 to 1), "category": "30yd-wall" | "sprinter" | "catcher" | "superfielder" | null }
  ]
}`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });
    return response.text;
  } catch (e: any) {
    if (e.message?.includes("Failed to fetch")) {
      console.error("Gemini API Network Error:", e);
      return JSON.stringify({ suggestions: [{ message: "Network error: Failed to connect to Gemini API. Please check your internet connection or disable adblockers.", type: "info", priority: "high" }], fielders: [] });
    }
    throw e;
  }
}
