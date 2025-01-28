import {Context, DynamoDBStreamEvent} from 'aws-lambda';
import {unmarshall} from '@aws-sdk/util-dynamodb';
import {JobRecord, updateJobImages, updateJobStatus} from './utils/dynamodb';
import {AttributeValue} from "@aws-sdk/client-dynamodb";
import {JobStatus, ReplicateResponse} from "./types";
import {downloadAndUploadToS3} from "./services/s3";
import {getPredictionStatus} from "./services/replicate";
import {Logger} from "./utils/logger";

const MAX_POLLING_TIME = 120000; // 2 minutes in milliseconds
const POLLING_INTERVAL = 3000; // 3 seconds

async function pollPredictionStatus(jobId: string, currentStatus: JobStatus): Promise<void> {
    const log = new Logger({ functionName: 'stream-processor', action: 'pollPredictionStatus', jobId });
    const startTime = Date.now();
    log.info('Starting prediction polling', { currentStatus });

    while (Date.now() - startTime < MAX_POLLING_TIME) {
        const { status, output, error } = await getPredictionStatus(jobId);

        if (status !== currentStatus) {
            log.info('Status changed', { oldStatus: currentStatus, newStatus: status });
            await updateJobStatus(jobId, status, output, error);

            if (status === JobStatus.SUCCEEDED && Array.isArray(output)) {
                log.info('Processing successful prediction output', { outputCount: output.length });
                const s3Urls = await Promise.all(
                    output.map((url: string) => downloadAndUploadToS3(url, jobId))
                );
                await updateJobImages(jobId, s3Urls);
                log.info('Successfully processed prediction output', { imageCount: s3Urls.length });
                break;
            }
        }

        if (status === JobStatus.FAILED) {
            log.error('Job failed', error);
            break;
        }

        log.debug('Waiting for next poll interval');
        await new Promise(resolve => setTimeout(resolve, POLLING_INTERVAL));
    }
}

export const handler = async (event: DynamoDBStreamEvent, context: Context): Promise<void> => {
    const log = new Logger({ functionName: 'stream-processor', action: 'handler' });
    log.info('Processing DynamoDB Stream event', { recordCount: event.Records.length });

    for (const record of event.Records) {
        if (!record.dynamodb?.NewImage) continue;

        const newImage = unmarshall(record.dynamodb.NewImage as Record<string, AttributeValue>) as JobRecord;
        const jobId = newImage.id;

        if (newImage.images && newImage.images.length > 0) {
            log.info('Skipping already processed job', { jobId, imageCount: newImage.images.length });
            continue;
        }

        try {
            if (newImage.status === JobStatus.STARTING) {
                await pollPredictionStatus(jobId, JobStatus.STARTING);
            }
        } catch (error) {
            log.error(`Error processing job`, error, { jobId });
            throw error;
        }
    }
};