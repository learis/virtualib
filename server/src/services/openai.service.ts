import OpenAI from 'openai';
import dotenv from 'dotenv';
dotenv.config();

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export const generateBookSummary = async (title: string, author: string): Promise<{ summary_tr: string; summary_en: string } | { error: string } | null> => {
    try {
        if (!process.env.OPENAI_API_KEY) {
            console.warn('OpenAI API Key not found. Skipping summary generation.');
            return { error: 'OpenAI API Key is missing on the server.' };
        }

        const prompt = `Please provide a brief summary for the book "${title}" by ${author}. 
        Provide the summary in two languages: Turkish and English. 
        Return the response strictly as a valid JSON object with keys "summary_tr" and "summary_en". 
        Do not include any other text or markdown formatting.`;

        const completion = await openai.chat.completions.create({
            messages: [{ role: "user", content: prompt }],
            model: "gpt-3.5-turbo",
        });

        const content = completion.choices[0].message.content;
        if (!content) return { error: 'No content received from OpenAI' };

        try {
            // Attempt to parse strictly, sometimes GPT adds md blocks
            const cleanContent = content.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(cleanContent);
        } catch (e) {
            console.error('Failed to parse OpenAI response:', content);
            return { error: 'Failed to parse AI response' };
        }
    } catch (error: any) {
        console.error('OpenAI API Error:', error);
        return { error: error.message || 'OpenAI API request failed' };
    }
};
