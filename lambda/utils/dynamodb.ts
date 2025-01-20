import { DynamoDBClient, PutItemCommand, GetItemCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { Logger } from './logger';

const dynamodb = new DynamoDBClient({});
const TABLE_NAME = process.env.REPLICATE_PROXY_TABLE!;
const logger = new Logger({ functionName: 'dynamodb' });

export interface JobRecord {
    id: string;
    input: any;
    output: any;
    status: string;
    images?: string[];
    createdAt: number;
    ttl?: number;
    error?: unknown;
}

export async function putJob(job: JobRecord): Promise<void> {
    const log = logger.withContext({ action: 'putJob', jobId: job.id });
    log.info('Putting job record', { status: job.status });

    await dynamodb.send(new PutItemCommand({
        TableName: TABLE_NAME,
        Item: marshall(job),
    })).catch(error => {
        log.error('Failed to put job record', error);
        throw error;
    });

    log.info('Successfully put job record');
}

export async function getJob(id: string): Promise<JobRecord | null> {
    const log = logger.withContext({ action: 'getJob', jobId: id });
    log.info('Getting job record');

    const response = await dynamodb.send(new GetItemCommand({
        TableName: TABLE_NAME,
        Key: marshall({ id }),
    })).catch(error => {
        log.error('Failed to get job record', error);
        throw error;
    });

    if (!response.Item) {
        log.info('Job record not found');
        return null;
    }

    log.info('Successfully retrieved job record');
    return unmarshall(response.Item) as JobRecord;
}

export async function updateJobStatus(id: string, status: string, output?: unknown, error?: string): Promise<void> {
    const log = logger.withContext({ action: 'updateJobStatus', jobId: id });
    log.info('Updating job status', { status, hasOutput: !!output, hasError: !!error });

    // Build update expression parts
    const updates: string[] = ['#status = :status'];
    const expressionAttributeNames: Record<string, string> = {
        '#status': 'status'
    };
    const expressionAttributeValues: Record<string, unknown> = {
        ':status': status
    };

    // Add output if provided
    if (output !== undefined) {
        updates.push('#output = :output');
        expressionAttributeNames['#output'] = 'output';
        expressionAttributeValues[':output'] = output;
    }

    // Add error if provided
    if (error !== undefined) {
        updates.push('#error = :error');
        expressionAttributeNames['#error'] = 'error';
        expressionAttributeValues[':error'] = error;
    }

    // Combine all updates into final expression
    const updateExpression = `SET ${updates.join(', ')}`;


    await dynamodb.send(new UpdateItemCommand({
        TableName: TABLE_NAME,
        Key: marshall({ id }),
        UpdateExpression: updateExpression,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: marshall(expressionAttributeValues),
    })).catch(error => {
        log.error('Failed to update job status', error);
        throw error;
    });

    log.info('Successfully updated job status');
}

export async function updateJobImages(id: string, images: string[]): Promise<void> {
    const log = logger.withContext({ action: 'updateJobImages', jobId: id });
    log.info('Updating job images', { imageCount: images.length });

    await dynamodb.send(new UpdateItemCommand({
        TableName: TABLE_NAME,
        Key: marshall({ id }),
        UpdateExpression: 'SET images = :images',
        ExpressionAttributeValues: marshall({
            ':images': images,
        }),
    })).catch(error => {
        log.error('Failed to update job images', error);
        throw error;
    });

    log.info('Successfully updated job images');
}