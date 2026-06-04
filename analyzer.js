import { GoogleGenAI, Type } from "@google/genai";
import * as fs from "fs";

// Initialize the client. It automatically picks up the GEMINI_API_KEY environment variable.
const ai = new GoogleGenAI({});

// Helper to convert local image to the format the API expects
function fileToGenerativePart(path, mimeType) {
  return {
    inlineData: {
      data: Buffer.from(fs.readFileSync(path)).toString("base64"),
      mimeType
    },
  };
}

async function analyzeFoodImage() {
  // 1. Load your bodybuilding meal prep image (e.g., meal.jpg)
  const imagePath = "meal2.jpg";
  const imagePart = fileToGenerativePart(imagePath, "image/jpeg");

  // 2. Define the exact JSON structure we want back for our app UI
  const nutritionSchema = {
    type: Type.OBJECT,
    properties: {
      meal_name: { type: Type.STRING },
      confidence_score: { type: Type.NUMBER },
      estimated_total_weight_grams: { type: Type.INTEGER },
      dishes: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            estimated_weight_g: { type: Type.INTEGER },
            calories: { type: Type.INTEGER },
            protein_g: { type: Type.INTEGER },
            carbs_g: { type: Type.INTEGER },
            fats_g: { type: Type.INTEGER },
          },
          required: ["name", "estimated_weight_g", "calories", "protein_g", "carbs_g", "fats_g"],
        },
      },
      micronutrients: {
        type: Type.OBJECT,
        properties: {
          vitamin_d_mcg: { type: Type.NUMBER },
          magnesium_mg: { type: Type.NUMBER },
          potassium_mg: { type: Type.NUMBER },
          sodium_mg: { type: Type.NUMBER },
        },
        required: ["vitamin_d_mcg", "magnesium_mg", "potassium_mg", "sodium_mg"],
      }
    },
    required: ["meal_name", "confidence_score", "estimated_total_weight_grams", "dishes", "micronutrients"],
  };

  try {
    console.log("Analyzing meal prep image via Gemini Free Tier...");

    // 3. Call Gemini 2.5 Flash (the free tier workhorse)
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        imagePart,
        "Analyze this plate of food for a bodybuilder. Estimate the weight in grams of each individual component using environmental context clues (plate size, utensils, depth). Calculate the macronutrients and critical recovery micronutrients. Be realistic with portions."
      ],
      config: {
        // Enforce JSON output matching our exact schema
        responseMimeType: "application/json",
        responseSchema: nutritionSchema,
        temperature: 0.2, // Low temperature for consistent math/estimation
      },
    });

    // 4. Parse and display the clean payload
    const result = JSON.parse(response.text);
    console.log("\n--- Structural Nutrition Payload Received ---");
    console.log(JSON.stringify(result, null, 2));

  } catch (error) {
    console.error("Error analyzing image:", error);
  }
}

analyzeFoodImage();
