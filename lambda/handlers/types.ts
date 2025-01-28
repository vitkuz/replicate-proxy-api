export enum TaskStatus {
    STARTING = 'starting',
    PROCESSING = 'processing',
    SUCCEEDED = 'succeeded',
    FAILED = 'failed'
}

export enum TaskType {
    REPLICATE = 'replicate',
    ELEVENLABS = 'elevenlabs',
    CHATGPT = 'chatgpt',
    PERPLEXITY = 'perplexity'
}

export enum StreamEventType {
    INSERT = 'INSERT',
    MODIFY = 'MODIFY',
    REMOVE = 'REMOVE'
}

export interface ElevenLabsInput {
    text: string;
    voiceId?: string;
    modelId?: string;
    stability?: number;
    similarityBoost?: number;
}

export interface ChatGPTInput {
    messages: Array<{
        role: 'system' | 'user' | 'assistant';
        content: string;
    }>;
    model?: string;
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
}

export interface PerplexityInput {
    messages: Array<{
        role: 'system' | 'user' | 'assistant';
        content: string;
    }>;
    model?: string;
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    topK?: number;
}

export interface Task {
    id: string;
    taskType: TaskType;
    status: TaskStatus;
    createdAt: number;
    updatedAt: number;
    input: Record<string, any>;
    output?: any;
    error?: string;
    webhookUrl?: string;
}

export interface TaskInput {
    taskType: TaskType;
    input: Record<string, any>;
    webhookUrl?: string;
}

export interface TaskUpdate {
    taskType?: TaskType;
    status?: TaskStatus;
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
    eventName: StreamEventType;
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
    status: TaskStatus;
    output?: unknown;
    error?: string;
}