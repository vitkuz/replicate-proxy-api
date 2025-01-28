import {ReplicateInput} from "../types";

export const getDefaultsHeaders = (requestId: string) => ({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Methods': '*',
    'X-Request-ID': requestId,
});
export const DEFAULT_REPLICATE_VERSION = '70a95a700a394552368f765fee2e22aa77d6addb933ba3ad914683c5e11940e1';
export const DEFAULT_INPUT_PARAMS: ReplicateInput = {
    model: 'dev',
    go_fast: false,
    lora_scale: 1,
    megapixels: '1',
    num_outputs: 1,
    aspect_ratio: '1:1',
    output_format: 'jpg',
    guidance_scale: 3,
    output_quality: 80,
    prompt_strength: 0.8,
    extra_lora_scale: 1,
    num_inference_steps: 28,
};