import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: (typeof process !== 'undefined' && process.env?.GEMINI_API_KEY) || (import.meta.env?.VITE_GEMINI_API_KEY as string) || "" });

export interface WeatherData {
  location: string;
  station?: string;
  temperature: number;
  humidity: number;
  windSpeed: number;
  cloudCover: number;
  precipitation: number;
  visibility: number;
  uvIndex: number;
  timeOfDay: "day" | "night";
}

export interface CCHIResponse {
  location: string;
  score: number;
  label: string;
  summary: string;
  spectatorHappinessScore: number;
  recommendedClothing: {
    spectators: string;
    players: string;
  };
  factors: {
    temp: string;
    wind: string;
    humidity: string;
    rain: string;
    uv: string;
    overall: string;
  };
}

export async function calculateCCHI(data: WeatherData): Promise<CCHIResponse> {
  const prompt = `
You are a cricket conditions analyst.

Your task is to calculate a "Cricket Conditions Happiness Index" (CCHI) from 0–100 using weather data for any location in the world.
Additionally, you need to calculate a "Spectator Happiness Score" (0-100) and recommend clothing for both spectators and players based on the weather conditions.

INPUT:
- Location: ${data.location}
- Temperature: ${data.temperature}°C
- Humidity: ${data.humidity}%
- Wind speed: ${data.windSpeed} MPH
- Cloud cover: ${data.cloudCover}%
- Precipitation: ${data.precipitation} mm
- Visibility: ${data.visibility} km
- UV index: ${data.uvIndex}
- Time of day: ${data.timeOfDay}

SCORING RULES:
- Rain: Rain = big penalty. Heavy rain = score near 0.
- Temperature: Best: 18–28°C. Too hot or cold = lower score.
- Wind: Light wind = good. Strong wind (e.g. > 15 MPH) = bad for batting.
- Humidity: Medium = good for swing. Very high = uncomfortable.
- Cloud: Some cloud = good for bowlers. Clear or full cloud = neutral.
- Visibility: Low visibility = bad.
- UV: Very high UV = slight penalty. Medium UV = ideal. Very low = damp conditions (slight penalty).
- Time: Day = good. Night (no lights) = bad (assume no lights for this calculation unless specified).

IMPORTANT:
- Rain has the biggest impact.
- Keep logic simple and balanced.
- Combine all factors into one score out of 100.
- Keep the explanation short and cricket-focused (mention batting, bowling, swing, comfort).

OUTPUT FORMAT (JSON):
{
  "location": "...",
  "score": number,
  "label": "Perfect" | "Great" | "Okay" | "Poor" | "Unplayable",
  "summary": "...",
  "spectatorHappinessScore": number,
  "recommendedClothing": {
    "spectators": "...",
    "players": "..."
  },
  "factors": {
    "temp": "...",
    "wind": "...",
    "humidity": "...",
    "rain": "...",
    "uv": "...",
    "overall": "..."
  }
}

Labels based on score:
- 90–100: Perfect
- 70–89: Great
- 50–69: Okay
- 30–49: Poor
- 0–29: Unplayable
`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            location: { type: Type.STRING },
            score: { type: Type.NUMBER },
            label: { type: Type.STRING },
            summary: { type: Type.STRING },
            spectatorHappinessScore: { type: Type.NUMBER },
            recommendedClothing: {
              type: Type.OBJECT,
              properties: {
                spectators: { type: Type.STRING },
                players: { type: Type.STRING },
              },
              required: ["spectators", "players"],
            },
            factors: {
              type: Type.OBJECT,
              properties: {
                temp: { type: Type.STRING },
                wind: { type: Type.STRING },
                humidity: { type: Type.STRING },
                rain: { type: Type.STRING },
                uv: { type: Type.STRING },
                overall: { type: Type.STRING },
              },
              required: ["temp", "wind", "humidity", "rain", "uv", "overall"],
            },
          },
          required: ["location", "score", "label", "summary", "spectatorHappinessScore", "recommendedClothing", "factors"],
        },
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error("Failed to generate CCHI");
    }

    return JSON.parse(text) as CCHIResponse;
  } catch (e: any) {
    if (e.message?.includes("Failed to fetch")) {
      throw new Error("Network error: Failed to connect to Gemini API. Please check your internet connection or disable adblockers.");
    }
    throw e;
  }
}
