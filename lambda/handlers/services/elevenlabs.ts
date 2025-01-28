import {ElevenLabsClient} from 'elevenlabs';
import {ElevenLabsInput, Task} from '../types';

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY!;
const DEFAULT_VOICE_ID = 'pNInz6obpgDQGcFmaJgB'; // Adam
const DEFAULT_MODEL_ID = 'eleven_multilingual_v2';

const elevenlabs = new ElevenLabsClient({
    apiKey: ELEVENLABS_API_KEY
});

export async function getElevenlabResponse(task: Task): Promise<Buffer> {
    const input = task.input
    const {
        text,
        voiceId = DEFAULT_VOICE_ID,
        modelId = DEFAULT_MODEL_ID,
        // stability,
        // similarityBoost
    } = input;

    try {
        return await elevenlabs.generate({
            voice: voiceId,
            text: text,
            model_id: modelId
        });
    } catch (error) {
        console.error('Error getting ElevenLabs response:', error);
        throw error;
    }
}