import {ElevenLabsClient} from 'elevenlabs';
import {Task} from '../types';
import * as stream from "node:stream";

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY!;
const DEFAULT_VOICE_ID = 'pNInz6obpgDQGcFmaJgB'; // Adam
const DEFAULT_MODEL_ID = 'eleven_multilingual_v2';

const elevenlabs = new ElevenLabsClient({
    apiKey: ELEVENLABS_API_KEY
});

export async function getElevenlabResponse(task: Task) {
    try {
        const response = await elevenlabs.generate(task.input);

        console.log(response);

        return response;
    } catch (error) {
        console.error('Error getting ElevenLabs response:', error);
        throw error;
    }
}