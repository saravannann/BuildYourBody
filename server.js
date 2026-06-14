import express from 'express';
import { GoogleGenAI, Type } from '@google/genai';
import { createClient } from '@supabase/supabase-js';
import multer from 'multer';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Initialize using the same SDK configuration pattern as your POC
const ai = new GoogleGenAI({});
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(process.env.SUPABASE_URL, supabaseKey);

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

        // --- Database Persistence Step ---

        // 1. Write metadata tracking metrics into parent table
        const { data: mealRow, error: mealError } = await supabase
            .from('meals')
            .insert([{
                meal_name: nutritionData.meal_name,
                confidence_score: nutritionData.confidence_score,
                estimated_total_weight_grams: nutritionData.estimated_total_weight_grams,
                vitamin_d_mcg: nutritionData.micronutrients.vitamin_d_mcg,
                magnesium_mg: nutritionData.micronutrients.magnesium_mg,
                potassium_mg: nutritionData.micronutrients.potassium_mg,
                sodium_mg: nutritionData.micronutrients.sodium_mg,
                bodybuilding_notes: nutritionData.bodybuilding_notes
            }])
            .select()
            .single();

        if (mealError) throw mealError;

        // 2. Map generated tracking key id onto child component items array
        const dishesToInsert = nutritionData.dishes.map(dish => ({
            meal_id: mealRow.id,
            name: dish.name,
            estimated_weight_g: dish.estimated_weight_g,
            calories: dish.calories,
            protein_g: dish.protein_g,
            carbs_g: dish.carbs_g,
            fats_g: dish.fats_g
        }));

        // 3. Perform batch transaction append operation on children components table
        const { error: dishesError } = await supabase
            .from('meal_dishes')
            .insert(dishesToInsert);

        if (dishesError) throw dishesError;

        // Return a response containing the full entity model back to the phone screen
        return res.json({
            message: "Meal scanned and logged successfully 🚀",
            meal_id: mealRow.id,
            data: nutritionData
        });
    } catch (error) {
        console.error('Data pipeline operations failed:', error);
        return res.status(500).json({ error: `Failed to analyze food image: ${error.message || error}` });
    }
});

// GET Endpoint to fetch historic entries for data logging dashboard
app.get('/api/history', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('meals')
            .select('*, meal_dishes(*)')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return res.json(data);
    } catch (error) {
        return res.status(500).json({ error: `Failed to query historical metrics: ${error.message || error}` });
    }
});

// DELETE Endpoint to delete historic entries and their associated dishes
app.delete('/api/history/:id', async (req, res) => {
    const { id } = req.params;
    try {
        // Delete child dishes from meal_dishes table first
        const { error: dishesError } = await supabase
            .from('meal_dishes')
            .delete()
            .eq('meal_id', id);

        if (dishesError) throw dishesError;

        // Delete parent meal from meals table
        const { error: mealError } = await supabase
            .from('meals')
            .delete()
            .eq('id', id);

        if (mealError) throw mealError;

        return res.json({ message: "Meal log deleted successfully 🗑️" });
    } catch (error) {
        console.error('Failed to delete meal log:', error);
        return res.status(500).json({ error: `Failed to delete meal log: ${error.message || error}` });
    }
});

// PUT Endpoint to update historic entries and their associated dishes
app.put('/api/history/:id', async (req, res) => {
    const { id } = req.params;
    const {
        meal_name,
        estimated_total_weight_grams,
        bodybuilding_notes,
        vitamin_d_mcg,
        magnesium_mg,
        potassium_mg,
        sodium_mg,
        dishes
    } = req.body;

    try {
        // Update the parent meal details
        const { error: mealError } = await supabase
            .from('meals')
            .update({
                meal_name,
                estimated_total_weight_grams,
                vitamin_d_mcg,
                magnesium_mg,
                potassium_mg,
                sodium_mg,
                bodybuilding_notes
            })
            .eq('id', id);

        if (mealError) throw mealError;

        // If dishes are provided, replace them
        if (dishes && Array.isArray(dishes)) {
            // Delete existing dishes for this meal
            const { error: deleteError } = await supabase
                .from('meal_dishes')
                .delete()
                .eq('meal_id', id);

            if (deleteError) throw deleteError;

            // Prepare dishes with meal_id
            const dishesToInsert = dishes.map(dish => ({
                meal_id: id,
                name: dish.name,
                estimated_weight_g: dish.estimated_weight_g,
                calories: dish.calories,
                protein_g: dish.protein_g,
                carbs_g: dish.carbs_g,
                fats_g: dish.fats_g
            }));

            // Insert updated dishes
            const { error: insertError } = await supabase
                .from('meal_dishes')
                .insert(dishesToInsert);

            if (insertError) throw insertError;
        }

        return res.json({ message: "Meal log updated successfully 📝" });
    } catch (error) {
        console.error('Failed to update meal log:', error);
        return res.status(500).json({ error: `Failed to update meal log: ${error.message || error}` });
    }
});

app.listen(port, () => {
    console.log(`Unified Nutrition Backend running on port ${port}`);
});