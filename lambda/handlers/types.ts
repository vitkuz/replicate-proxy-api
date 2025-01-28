export interface Task {
    id: string;
    taskType: 'replicate';
    status: 'starting' | 'processing' | 'succeeded' | 'failed';
    createdAt: number;
    updatedAt: number;
    input: Record<string, any>;
    output?: any;
    error?: string;
    webhookUrl?: string;
}

export interface TaskInput {
    taskType: 'replicate';
    input: Record<string, any>;
    webhookUrl?: string;
}

export interface TaskUpdate {
    taskType?: string;
    status?: 'starting' | 'processing' | 'succeeded' | 'failed';
    payload?: Record<string, any>;
    result?: any;
    error?: string;
    webhookUrl?: string;
}

export interface ErrorResponse {
    message: string;
    statusCode: number;
}

export interface SuccessResponse<T> {
    data: T;
    statusCode: number;
}

export type ApiResponse<T> = ErrorResponse | SuccessResponse<T>;

export interface StreamEvent {
    eventName: 'INSERT' | 'MODIFY' | 'REMOVE';
    dynamodb: {
        NewImage?: any;
        OldImage?: any;
    };
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