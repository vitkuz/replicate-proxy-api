import Replicate from 'replicate';
import {Task} from "../types";

const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN!;

export interface ReplicateImageParams {
    model?: string;
    go_fast?: boolean;
    lora_scale?: number;
    megapixels?: string;
    num_outputs?: number;
    aspect_ratio?: string;
    output_format?: string;
    guidance_scale?: number;
    output_quality?: number;
    prompt_strength?: number;
    extra_lora_scale?: number;
    num_inference_steps?: number;
}

const replicate = new Replicate({
    auth: REPLICATE_API_TOKEN,
});

export async function getReplicateResponse(task: Task)

// TODO: COMPLETE