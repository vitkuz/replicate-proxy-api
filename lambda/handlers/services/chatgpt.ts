import OpenAI from 'openai';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;
const DEFAULT_MODEL = 'o4';

const openai = new OpenAI({
    apiKey: OPENAI_API_KEY
});

export async function generateChatResponse(input: any): Promise<string> {
    const {
        messages,
        model = DEFAULT_MODEL,
        temperature = 0.7,
        maxTokens = 1000,
        topP = 1,
        frequencyPenalty = 0,
        presencePenalty = 0
    } = input;

    try {
        const response = await openai.chat.completions.create({
            model,
            messages,
            temperature,
            max_tokens: maxTokens,
            top_p: topP,
            frequency_penalty: frequencyPenalty,
            presence_penalty: presencePenalty
        });

        return response.choices[0]?.message?.content || '';
    } catch (error) {
        console.error('Error generating ChatGPT response:', error);
        throw error;
    }
}