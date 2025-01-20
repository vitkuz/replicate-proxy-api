import {Context, DynamoDBStreamEvent} from 'aws-lambda';
import axios from 'axios';
import {PutObjectCommand, S3Client} from '@aws-sdk/client-s3';
import {v4 as uuidv4} from 'uuid';
import {unmarshall} from '@aws-sdk/util-dynamodb';
import {JobRecord, updateJobImages, updateJobStatus} from './utils/dynamodb';
import {AttributeValue} from "@aws-sdk/client-dynamodb";
import {JobStatus, ReplicateResponse} from "./types";
import {downloadAndUploadToS3} from "./services/s3";
import {getPredictionStatus} from "./services/replicate";

const MAX_POLLING_TIME = 120000; // 2 minutes in milliseconds
const POLLING_INTERVAL = 3000; // 3 seconds

async function pollPredictionStatus(jobId: string, currentStatus: JobStatus): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < MAX_POLLING_TIME) {
        const { status, output } = await getPredictionStatus(jobId);

        if (status !== currentStatus) {
            await updateJobStatus(jobId, status, output); //todo: record error

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