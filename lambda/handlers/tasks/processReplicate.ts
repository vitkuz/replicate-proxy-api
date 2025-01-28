import {Task, TaskStatus} from "../types";
import {partialUpdateRecord} from "../services/dynamo";
import {sendWebhookNotification} from "../utils/webhook";
import Replicate from "replicate";

const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN!;

const replicate = new Replicate({
    auth: REPLICATE_API_TOKEN,
});

export async function processReplicateTask(task: Task): Promise<void> {
    try {
        await partialUpdateRecord(task.id, {
            status: TaskStatus.PROCESSING,
            updatedAt: Date.now()
        });

        const response = await getReplicateResponse(task);

        await partialUpdateRecord(task.id, {
            status: TaskStatus.SUCCEEDED,
            output: response,
            updatedAt: Date.now()
        });

        await partialUpdateRecord(task.id, {
            status: TaskStatus.SUCCEEDED,
            output: response,
            updatedAt: Date.now()
        });

    } catch (error) {
        console.error('Error processing Replicate task:', error);

        await partialUpdateRecord(task.id, {
            status: TaskStatus.FAILED,
            error: error instanceof Error ? error.message : 'Unknown error',
            output: null,
            updatedAt: Date.now()
        });

        throw error;
    }
}