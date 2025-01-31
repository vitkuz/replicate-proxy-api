import {Task, TaskStatus} from "../types";
import {partialUpdateRecord} from "../services/dynamo";
import {
    getReplicateResponse,
} from "../services/replicate";

export async function processDeepSeekR1Task(task: Task): Promise<void> {
    try {
        await partialUpdateRecord(task.id, {
            status: TaskStatus.PROCESSING,
            updatedAt: Date.now()
        });

        // validate task input with zod

        const response = await getReplicateResponse(task);

        const output = (response as unknown as string[]).join('')

        await partialUpdateRecord(task.id, {
            status: TaskStatus.SUCCEEDED,
            output,
            updatedAt: Date.now()
        });

    } catch (error) {
        console.error('Error processing Minimax Video task:', error);

        await partialUpdateRecord(task.id, {
            status: TaskStatus.FAILED,
            error: error instanceof Error ? error.message : 'Unknown error',
            output: null,
            updatedAt: Date.now()
        });

        throw error;
    }
}