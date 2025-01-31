import {v4, v4 as uuidv4} from "uuid";
import axios from "axios";
import {PutObjectCommand, S3Client} from "@aws-sdk/client-s3";

const path = require('path');
const fs = require('fs');

const DEFAULT_VOICE_ID = "pNInz6obpgDQGcFmaJgB"; // Adam
const DEFAULT_MODEL_ID = "eleven_multilingual_v2";
const DEFAULT_LANGUAGE = "ru";

const AWS_REGION = process.env.AWS_REGION || "us-east-1";
const BUCKET_NAME = process.env.BUCKET_NAME;
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_API_URL = "https://api.elevenlabs.io/v1/text-to-speech";

const s3Client = new S3Client({region: AWS_REGION});

// Enum for supported audio formats
enum AudioFormat {
    MP3 = "mp3",
    WAV = "wav",
    OGG = "ogg",
}

// Mapping of audio formats to MIME types
const MIME_TYPES: Record<AudioFormat, string> = {
    [AudioFormat.MP3]: "audio/mpeg",
    [AudioFormat.WAV]: "audio/wav",
    [AudioFormat.OGG]: "audio/ogg",
};

// Type for MIME type keys
type AudioFormatKeys = keyof typeof AudioFormat;

// Task input type
interface TaskInput {
    voice_id: string;
    text: string;
    model_id: string;
    language: string;
    format?: AudioFormat;
}

// Task type
interface Task {
    input: TaskInput;
}

// Utility function to get MIME type based on file extension
function getContentType(extension: AudioFormat): string {
    return MIME_TYPES[extension] || "application/octet-stream";
}

// Save generated files locally
export function saveElevenlabsFilesLocally(data: Buffer, format: AudioFormat): { filename: string; ext: string }[] {
    const filename = `/tmp/output_${v4()}.${format}`;
    fs.writeFileSync(filename, data);
    console.log(`Voice narration saved as ${filename}`);
    return [{filename, ext: `.${format}`}];
}

// Generate voice narration using ElevenLabs API
export async function getElevenlabsResponse(task: Task): Promise<{ data: Buffer; format: AudioFormat }> {
    try {
        const {
            voice_id= DEFAULT_VOICE_ID,
            text= 'Hello from eleven labs',
            model_id = DEFAULT_MODEL_ID,
            language = DEFAULT_LANGUAGE
        } = task.input;
        const response = await axios.post(
            `${ELEVENLABS_API_URL}/${voice_id}`,
            {
                text,
                model_id,
                language,
                voice_settings: {
                    stability: 0.5, // Stability of the voice (optional, range: 0.0 to 1.0)
                    similarity_boost: 0.75, // Similarity boost (optional, range: 0.0 to 1.0)
                }
            },
            {
                headers: {
                    "xi-api-key": ELEVENLABS_API_KEY,
                    "Content-Type": "application/json",
                },
                responseType: "arraybuffer",
            }
        );
        return {data: response.data, format: AudioFormat.MP3};
    } catch (error) {
        console.error("Error generating voice narration:", error);
        throw error;
    }
}

// Upload generated files to S3
export async function saveElevenlabsFilesToS3(files: { filename: string; ext: string }[]): Promise<string[]> {
    const uploadedUrls: string[] = [];

    for (const {filename, ext} of files) {
        try {
            const fileStream = fs.readFileSync(filename);
            const contentType = getContentType(ext.slice(1) as AudioFormat);

            const uploadParams = {
                Bucket: BUCKET_NAME,
                Key: `elevenlabs_outputs/${path.basename(filename)}`,
                Body: fileStream,
                ContentType: contentType,
            };

            console.log(`Uploading ${filename} to S3...`);
            const command = new PutObjectCommand(uploadParams);
            await s3Client.send(command);

            const fileUrl = `https://${BUCKET_NAME}.s3.${AWS_REGION}.amazonaws.com/${uploadParams.Key}`;
            console.log(`Uploaded: ${fileUrl}`);
            uploadedUrls.push(fileUrl);

            fs.unlinkSync(filename);
            console.log(`Deleted local file: ${filename}`);
        } catch (error) {
            console.error(`Error uploading ${filename} to S3:`, error);
        }
    }

    return uploadedUrls;
}
