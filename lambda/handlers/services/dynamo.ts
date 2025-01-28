import { DynamoDBClient, ReturnValue } from '@aws-sdk/client-dynamodb';
import {
    DynamoDBDocumentClient,
    PutCommand,
    DeleteCommand,
    GetCommand,
    UpdateCommand,
    ScanCommand
} from '@aws-sdk/lib-dynamodb';

const dynamoDBClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoDBClient, {
    marshallOptions: {
        removeUndefinedValues: true
    }
});
const TableName = process.env.TABLE_NAME!;

export interface DynamoRecord {
    id: string;
    [key: string]: any;
}

export async function getRecordById(id: string): Promise<DynamoRecord | null> {
    console.log('getRecordById called with id:', id);
    const params = {
        TableName,
        Key: { id }
    };

    try {
        const result = await docClient.send(new GetCommand(params));
        console.log('getRecordById result:', result);
        return result.Item as DynamoRecord || null;
    } catch (error) {
        console.error('Error in getRecordById:', error);
        throw error;
    }
}

export async function deleteRecordById(id: string): Promise<void> {
    console.log('deleteRecordById called with id:', id);
    const params = {
        TableName,
        Key: { id }
    };

    try {
        await docClient.send(new DeleteCommand(params));
        console.log('deleteRecordById success for id:', id);
    } catch (error) {
        console.error('Error in deleteRecordById:', error);
        throw error;
    }
}

export async function createRecord(record: DynamoRecord): Promise<DynamoRecord> {
    console.log('createRecord called with record:', record);
    const params = {
        TableName,
        Item: record
    };

    try {
        await docClient.send(new PutCommand(params));
        console.log('createRecord success for record:', record);
        return record;
    } catch (error) {
        console.error('Error in createRecord:', error);
        throw error;
    }
}

export async function partialUpdateRecord(id: string, updates: Partial<DynamoRecord>): Promise<DynamoRecord> {
    console.log('partialUpdateRecord called with id:', id, 'updates:', updates);
    const updateExpressions: string[] = [];
    const expressionAttributeNames: { [key: string]: string } = {};
    const expressionAttributeValues: { [key: string]: any } = {};

    Object.entries(updates).forEach(([key, value], index) => {
        if (key !== 'id') {
            const attributeName = `#attr${index}`;
            const attributeValue = `:val${index}`;
            updateExpressions.push(`${attributeName} = ${attributeValue}`);
            expressionAttributeNames[attributeName] = key;
            expressionAttributeValues[attributeValue] = value;
        }
    });

    const params = {
        TableName,
        Key: { id },
        UpdateExpression: `SET ${updateExpressions.join(', ')}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ReturnValues: 'ALL_NEW' as ReturnValue
    };

    try {
        const result = await docClient.send(new UpdateCommand(params));
        console.log('partialUpdateRecord result:', result);
        return result.Attributes as DynamoRecord || {} as DynamoRecord;
    } catch (error) {
        console.error('Error in partialUpdateRecord:', error);
        throw error;
    }
}

export async function updateRecord(id: string, record: Omit<DynamoRecord, 'id'>): Promise<DynamoRecord> {
    console.log('updateRecord called with id:', id, 'record:', record);
    const fullRecord = {
        id,
        ...record
    };

    const params = {
        TableName,
        Item: fullRecord
    };

    try {
        await docClient.send(new PutCommand(params));
        console.log('updateRecord success for id:', id);
        return fullRecord;
    } catch (error) {
        console.error('Error in updateRecord:', error);
        throw error;
    }
}

export async function getAllRecords(): Promise<DynamoRecord[]> {
    console.log('getAllRecords called');
    const records: DynamoRecord[] = [];

    async function scanRecursively(lastEvaluatedKey?: Record<string, any>) {
        const params = {
            TableName,
            ExclusiveStartKey: lastEvaluatedKey
        };

        try {
            const result = await docClient.send(new ScanCommand(params));
            console.log('scanRecursively result:', result);

            if (result.Items) {
                records.push(...(result.Items as DynamoRecord[]));
            }

            if (result.LastEvaluatedKey) {
                await scanRecursively(result.LastEvaluatedKey);
            }
        } catch (error) {
            console.error('Error in scanRecursively:', error);
            throw error;
        }
    }

    await scanRecursively();
    console.log('getAllRecords result:', records);
    return records;
}
