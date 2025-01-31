import {Task, TaskStatus} from "../types";
import {partialUpdateRecord} from "../services/dynamo";
import {
    getReplicateResponse,
    saveReplicationFilesToS3,
    saveReplicationVideoLocally
} from "../services/replicate";

export async function processKlingProTask(task: Task): Promise<void> {
    try {
        await partialUpdateRecord(task.id, {
            status: TaskStatus.PROCESSING,
            updatedAt: Date.now()
        });

        // validate task input with zod

        const response = await getReplicateResponse(task);

        const savedFiles = await saveReplicationVideoLocally(response as ReadableStream);

        const s3Urls = await saveReplicationFilesToS3(savedFiles);

        await partialUpdateRecord(task.id, {
            status: TaskStatus.SUCCEEDED,
            output: s3Urls,
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