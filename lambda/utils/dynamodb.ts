import { DynamoDBClient, PutItemCommand, GetItemCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';

const dynamodb = new DynamoDBClient({});
const TABLE_NAME = process.env.REPLICATE_PROXY_TABLE!;

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
    await dynamodb.send(new PutItemCommand({
        TableName: TABLE_NAME,
        Item: marshall(job),
    }));
}

export async function getJob(id: string): Promise<JobRecord | null> {
    const response = await dynamodb.send(new GetItemCommand({
        TableName: TABLE_NAME,
        Key: marshall({ id }),
    }));

    if (!response.Item) {
        return null;
    }

    return unmarshall(response.Item) as JobRecord;
}

export async function updateJobStatus(id: string, status: string, output?: unknown, error?: string): Promise<void> {
    //todo: record error
    const updateExpression = output
        ? 'SET #status = :status, #output = :output'
        : 'SET #status = :status';

    const expressionAttributeNames = {
        '#status': 'status',
        // @ts-ignore
        ...(output && { '#output': 'output' }),
    };

    const expressionAttributeValues = {
        ':status': status,
        // @ts-ignore
        ...(output && { ':output': output })
    };

    await dynamodb.send(new UpdateItemCommand({
        TableName: TABLE_NAME,
        Key: marshall({ id }),
        UpdateExpression: updateExpression,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: marshall(expressionAttributeValues),
    }));
}

export async function updateJobImages(id: string, images: string[]): Promise<void> {
    await dynamodb.send(new UpdateItemCommand({
        TableName: TABLE_NAME,
        Key: marshall({ id }),
        UpdateExpression: 'SET images = :images',
        ExpressionAttributeValues: marshall({
            ':images': images,
        }),
    }));
}