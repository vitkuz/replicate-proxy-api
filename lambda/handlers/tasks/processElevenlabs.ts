import {Task, TaskStatus} from "../types";
import {partialUpdateRecord} from "../services/dynamo";
import {getElevenlabsResponse, saveElevenlabsFilesLocally, saveElevenlabsFilesToS3} from "../services/elevenlabs";

export async function processElevenLabsTask(task: Task): Promise<void> {
    try {
        await partialUpdateRecord(task.id, {
            status: TaskStatus.PROCESSING,
            updatedAt: Date.now()
        });

        // validate task input with zod schema

        const {data, format} = await getElevenlabsResponse(task);

        const savedFiles = saveElevenlabsFilesLocally(data, format);

        const s3Urls = await saveElevenlabsFilesToS3(savedFiles);

        await partialUpdateRecord(task.id, {
            status: TaskStatus.SUCCEEDED,
            output: s3Urls,
            updatedAt: Date.now()
        });

    } catch (error) {
        console.error('Error processing ElevenLabs task:', error);

        await partialUpdateRecord(task.id, {
            status: TaskStatus.FAILED,
            error: error instanceof Error ? error.message : 'Unknown error',
            output: null,
            updatedAt: Date.now()
        });

        throw error;
    }
}