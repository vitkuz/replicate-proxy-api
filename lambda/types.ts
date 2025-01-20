export enum JobStatus {
    STARTING = 'starting',
    PROCESSING = 'processing',
    SUCCEEDED = 'succeeded',
    FAILED = 'failed'
}

export interface ReplicateInput {
    model: string;
    go_fast: boolean;
    lora_scale: number;
    megapixels: string;
    num_outputs: number;
    aspect_ratio: string;
    output_format: string;
    guidance_scale: number;
    output_quality: number;
    prompt_strength: number;
    extra_lora_scale: number;
    num_inference_steps: number;

    [key: string]: unknown; // Allow additional properties
}

export interface ReplicateRequest {
    version: string;
    input: ReplicateInput;
}

export interface ReplicateResponse {
    input: ReplicateRequest;
    id: string;
    status: 'starting' | 'processing' | 'succeeded' | 'failed';
    output?: unknown;
    error?: string;
}