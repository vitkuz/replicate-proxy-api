import {Task, TaskStatus} from "../types";
import {partialUpdateRecord} from "../services/dynamo";
import {generateChatResponse} from "../services/chatgpt";

export async function processChatGPTTask(task: Task): Promise<void> {
    try {
        await partialUpdateRecord(task.id, {
            status: TaskStatus.PROCESSING,
            updatedAt: Date.now()
        });

        const response = await generateChatResponse(task.input);

        await partialUpdateRecord(task.id, {
            status: TaskStatus.SUCCEEDED,
            output: response,
            updatedAt: Date.now()
        });
    } catch (error) {
        console.error('Error processing ChatGPT task:', error);

        await partialUpdateRecord(task.id, {
            status: TaskStatus.FAILED,
            error: error instanceof Error ? error.message : 'Unknown error',
            output: null,
            updatedAt: Date.now()
        });

        throw error;
    }
}