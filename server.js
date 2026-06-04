import express from 'express';
import { GoogleGenAI, Type } from '@google/genai';
import multer from 'multer';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Initialize using the same SDK configuration pattern as your POC
const ai = new GoogleGenAI({});

const upload = multer({ storage: multer.memoryStorage() });

app.use(express.json());

// Merged & Optimized Schema directly honoring your POC structure
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
        },
        bodybuilding_notes: {
            type: Type.STRING,
            description: "Coach insight on how this meal serves fitness goals (e.g., recovery, clean bulking, sodium impact)."
        }
    },
    required: ["meal_name", "confidence_score", "estimated_total_weight_grams", "dishes", "micronutrients", "bodybuilding_notes"],
};

app.post('/api/analyze-plate', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Please upload an image of your plate.' });
        }

        // Buffer handling mapping your POC inlineData requirement
        const imagePart = {
            inlineData: {
                data: req.file.buffer.toString("base64"),
                mimeType: req.file.mimetype
            },
        };

        // Your precise POC prompt with minor additions to backfill totals if needed
        const prompt = `
            Analyze this plate of food for a bodybuilder. Estimate the weight in grams of each individual component 
            using environmental context clues (plate size, utensils, depth). Calculate the macronutrients and critical 
            recovery micronutrients. Be realistic with portions.
        `;

        // Upgraded to your POC preferred model (gemini-2.5-flash)
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [imagePart, prompt],
            config: {
                responseMimeType: 'application/json',
                responseSchema: nutritionSchema,
                temperature: 0.2, // Retaining low temperature for consistent mathematical evaluation
            }
        });

        const nutritionData = JSON.parse(response.text);
        return res.json(nutritionData);

    } catch (error) {
        console.error('Error analyzing image:', error);
        return res.status(500).json({ error: 'Failed to analyze food image.' });
    }
});

app.listen(port, () => {
    console.log(`Unified Nutrition Backend running on port ${port}`);
});