import {Task, TaskStatus} from "../types";
import {partialUpdateRecord} from "../services/dynamo";
import {getReplicateResponse, saveReplicationFilesLocally, saveReplicationFilesToS3} from "../services/replicate";

export async function processReplicateTask(task: Task): Promise<void> {
    try {
        await partialUpdateRecord(task.id, {
            status: TaskStatus.PROCESSING,
            updatedAt: Date.now()
        });

        // validate task input with zod

        const response = await getReplicateResponse(task);

        const savedFiles = await saveReplicationFilesLocally(response as string[]);

        const s3Urls = await saveReplicationFilesToS3(savedFiles);

        await partialUpdateRecord(task.id, {
            status: TaskStatus.SUCCEEDED,
            output: s3Urls,
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