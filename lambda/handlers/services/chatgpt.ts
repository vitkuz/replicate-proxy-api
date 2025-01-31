import OpenAI from 'openai';
import { ChatGPTInput, Task } from '../types';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;

const openai = new OpenAI({
    apiKey: OPENAI_API_KEY
});

export async function generateChatResponse(task: Task){
    try {
        const input = task.input as ChatGPTInput;

        // @ts-ignore //todo: fix this
        const response = await openai.chat.completions.create(input);

        console.log(JSON.stringify(response, null, 2));

        return response;
    } catch (error) {
        throw error;
    }
}