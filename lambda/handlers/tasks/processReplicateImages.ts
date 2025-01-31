import {Task, TaskStatus} from "../types";
import {partialUpdateRecord} from "../services/dynamo";
import {getReplicateResponse, saveReplicationFilesLocally, saveReplicationFilesToS3} from "../services/replicate";
import {sendTaskNotification} from "../services/sns";
import {sendWebhookNotification} from "../services/webhook";

export async function processReplicateImagesTask(task: Task): Promise<void> {
    try {
        await partialUpdateRecord(task.id, {
            status: TaskStatus.PROCESSING,
            updatedAt: Date.now()
        });

        JSON.stringify(task, null, 2);

        // validate task input with zod

        const response = await getReplicateResponse(task);

        console.log('Replicate response:', response);

        const savedFiles = await saveReplicationFilesLocally(response as string[]);

        console.log('Saved files:', savedFiles);

        const s3Urls = await saveReplicationFilesToS3(savedFiles);

        console.log('S3 URLs:', s3Urls);

        const updatedTask = await partialUpdateRecord(task.id, {
            status: TaskStatus.SUCCEEDED,
            output: s3Urls,
            updatedAt: Date.now()
        });

        console.log('Updated task:', updatedTask);

        await sendTaskNotification(updatedTask as Task);

        await sendWebhookNotification(updatedTask as Task);

    } catch (error) {
        console.error('Error processing Replicate task:', error);
        const updatedTask = await partialUpdateRecord(task.id, {
            status: TaskStatus.FAILED,
            error: error instanceof Error ? error.message : 'Unknown error',
            output: null,
            updatedAt: Date.now()
        });
        console.log('Updated task:', updatedTask);
        await sendTaskNotification(updatedTask as Task);
        await sendWebhookNotification(updatedTask as Task);
        throw error;
    }
}