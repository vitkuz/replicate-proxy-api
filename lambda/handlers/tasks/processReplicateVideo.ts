import {Task, TaskStatus} from "../types";
import {partialUpdateRecord} from "../services/dynamo";
import {
    getReplicateResponse,
    saveReplicationFilesToS3,
    saveReplicationVideoLocally
} from "../services/replicate";
import {sendWebhookNotification} from "../services/webhook";

export async function processReplicateVideo(task: Task): Promise<void> {
    try {
        await partialUpdateRecord(task.id, {
            status: TaskStatus.PROCESSING,
            updatedAt: Date.now()
        });

        JSON.stringify(task, null, 2);

        // validate task input with zod

        const response = await getReplicateResponse(task);

        console.log('Replicate response:', response);

        const savedFiles = await saveReplicationVideoLocally(response as ReadableStream);

        console.log('Saved files:', savedFiles);

        const s3Urls = await saveReplicationFilesToS3(savedFiles);

        console.log('S3 URLs:', s3Urls);

        const updatedTask = await partialUpdateRecord(task.id, {
            status: TaskStatus.SUCCEEDED,
            output: s3Urls,
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