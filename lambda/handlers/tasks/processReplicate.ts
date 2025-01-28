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

        const version = task.input.version;
        const input = task.input.input;

        const replicateResponse = await replicate.run(version, { input });

        await partialUpdateRecord(task.id, {
            status: TaskStatus.SUCCEEDED,
            output: replicateResponse,
            updatedAt: Date.now()
        });

        await partialUpdateRecord(task.id, {
            status: TaskStatus.SUCCEEDED,
            output: replicateResponse,
            updatedAt: Date.now()
        });

        if (task.webhookUrl) {
            await sendWebhookNotification(task.webhookUrl, {
                taskId: task.id,
                status: TaskStatus.SUCCEEDED,
                output: replicateResponse
            });
        }
    } catch (error) {
        console.error('Error processing Replicate task:', error);

        await partialUpdateRecord(task.id, {
            status: TaskStatus.FAILED,
            error: error instanceof Error ? error.message : 'Unknown error',
            output: null,
            updatedAt: Date.now()
        });

        if (task.webhookUrl) {
            await sendWebhookNotification(task.webhookUrl, {
                taskId: task.id,
                status: TaskStatus.FAILED,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }

        throw error;
    }
}