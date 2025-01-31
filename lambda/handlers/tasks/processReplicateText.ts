import {Task, TaskStatus} from "../types";
import {partialUpdateRecord} from "../services/dynamo";
import {
    getReplicateResponse,
} from "../services/replicate";
import {sendWebhookNotification} from "../services/webhook";

export async function processReplicateText(task: Task): Promise<void> {
    try {
        await partialUpdateRecord(task.id, {
            status: TaskStatus.PROCESSING,
            updatedAt: Date.now()
        });

        JSON.stringify(task, null, 2);

        // validate task input with zod

        const response = await getReplicateResponse(task);

        console.log('Replicate response:', response);

        const output = (response as unknown as string[]).join('')

        const updatedTask = await partialUpdateRecord(task.id, {
            status: TaskStatus.SUCCEEDED,
            output,
            updatedAt: Date.now()
        });

        console.log('Updated task:', updatedTask);

        await sendWebhookNotification(updatedTask as Task);

    } catch (error) {
        console.error('Error processing Minimax Video task:', error);
        const updatedTask = await partialUpdateRecord(task.id, {
            status: TaskStatus.FAILED,
            error: error instanceof Error ? error.message : 'Unknown error',
            output: null,
            updatedAt: Date.now()
        });
        console.log('Updated task:', updatedTask);
        await sendWebhookNotification(updatedTask as Task);
        throw error;
    }
}