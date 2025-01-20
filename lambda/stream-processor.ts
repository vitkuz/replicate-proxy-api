import { Context, DynamoDBStreamEvent } from 'aws-lambda';
import axios from 'axios';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import { updateJobImages, updateJobStatus } from './utils/dynamodb';
import { JobRecord } from './utils/dynamodb';
import {AttributeValue} from "@aws-sdk/client-dynamodb";

enum JobStatus {
    STARTING = 'starting',
    PROCESSING = 'processing',
    SUCCEEDED = 'succeeded',
    FAILED = 'failed'
}

const REPLICATE_API_BASE = 'https://api.replicate.com/v1';
const s3 = new S3Client({});
const BUCKET_NAME = process.env.IMAGES_BUCKET!;
const MAX_POLLING_TIME = 120000; // 2 minutes in milliseconds
const POLLING_INTERVAL = 3000; // 3 seconds

async function getPredictionStatus(predictionId: string): Promise<{ status: JobStatus; output?: unknown }> {
    const response = await axios.get(
        `${REPLICATE_API_BASE}/predictions/${predictionId}`,
        {
            headers: {
                Authorization: `Bearer ${process.env.REPLICATE_API_TOKEN!}`,
            },
        }
    );
    return {
        status: response.data.status as JobStatus,
        output: response.data.output
    };
}

async function pollPredictionStatus(jobId: string, currentStatus: JobStatus): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < MAX_POLLING_TIME) {
        const { status, output } = await getPredictionStatus(jobId);

        if (status !== currentStatus) {
            await updateJobStatus(jobId, status, output);

            if (status === JobStatus.SUCCEEDED && Array.isArray(output)) {
                const s3Urls = await Promise.all(
                    output.map((url: string) => downloadAndUploadToS3(url, jobId))
                );
                await updateJobImages(jobId, s3Urls);
                console.log(`Successfully downloaded ${s3Urls.length} images for job ${jobId}`);
                break;
            }
        }

        if (status === JobStatus.FAILED) {
            console.log(`Job ${jobId} failed`);
            break;
        }

        await new Promise(resolve => setTimeout(resolve, POLLING_INTERVAL));
    }
}

function getDateBasedPath(): string {
    const now = new Date();
    return `${now.getUTCFullYear()}/${(now.getUTCMonth() + 1).toString().padStart(2, '0')}/${now.getUTCDate().toString().padStart(2, '0')}`;
}

async function downloadAndUploadToS3(imageUrl: string, jobId: string): Promise<string> {
    try {
        // Download image
        const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
        const buffer = Buffer.from(response.data);

        // Generate unique filename with date-based path
        const extension = imageUrl.split('.').pop() || 'jpg';
        const filename = `${uuidv4()}.${extension}`;
        const datePath = getDateBasedPath();
        const key = `${jobId}/${datePath}/${filename}`;

        // Upload to S3
        await s3.send(new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key,
            Body: buffer,
            ContentType: `image/${extension}`,
        }));

        // Return S3 URL
        return `s3://${BUCKET_NAME}/${key}`;
    } catch (error) {
        console.error('Failed to process image', error);
        throw error;
    }
}

export const handler = async (event: DynamoDBStreamEvent, context: Context): Promise<void> => {
    console.log('Event:', JSON.stringify(event, null, 2));

    for (const record of event.Records) {
        if (!record.dynamodb?.NewImage) continue;

        const newImage = unmarshall(record.dynamodb.NewImage as Record<string, AttributeValue>) as JobRecord;
        const jobId = newImage.id;

        if (newImage.images && newImage.images.length > 0) {
            console.log(`Job ${jobId} already has processed images, skipping`);
            continue;
        }

        try {
            if (newImage.status === JobStatus.STARTING) {
                await pollPredictionStatus(jobId, JobStatus.STARTING);
            }
        } catch (error) {
            console.error(`Error processing job ${jobId}:`, error);
            throw error;
        }
    }
};