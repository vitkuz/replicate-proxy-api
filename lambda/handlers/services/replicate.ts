import Replicate from 'replicate';
import {Task} from "../types";

const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN!;

const replicate = new Replicate({
    auth: REPLICATE_API_TOKEN,
});

export async function getReplicateResponse(task: Task): Promise<unknown> {

    try {
        const { version, input } = task.input;

        const response = await replicate.run(version, {
            input
        });

        console.log(response);

        return response;
    } catch (error) {
        throw error;
    }
}