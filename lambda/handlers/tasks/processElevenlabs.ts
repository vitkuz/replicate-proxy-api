import {Task, TaskStatus} from "../types";
import {partialUpdateRecord} from "../services/dynamo";
import {getElevenlabResponse} from "../services/elevenlabs";

export async function processElevenLabsTask(task: Task): Promise<void> {
    try {
        await partialUpdateRecord(task.id, {
            status: TaskStatus.PROCESSING,
            updatedAt: Date.now()
        });

        const response  = await getElevenlabResponse(task);

        await partialUpdateRecord(task.id, {
            status: TaskStatus.SUCCEEDED,
            output: response,
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