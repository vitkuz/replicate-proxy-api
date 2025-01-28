import {APIGatewayProxyEvent, APIGatewayProxyResult} from 'aws-lambda';
import { partialUpdateRecord, getRecordById } from './services/dynamo';
import { TaskUpdate } from './types';
import { validateTaskUpdate } from './utils/validation';
import {v4 as uuidv4} from "uuid";
import {getDefaultsHeaders} from "./const";

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    console.log(JSON.stringify(event , null , 2))
    const requestId = uuidv4();
    try {
        const taskId = event.pathParameters?.id;

        if (!taskId || !event.body) {
            return {
                statusCode: 400,
                headers: getDefaultsHeaders(requestId),
                body: JSON.stringify({
                    message: 'Task ID and request body are required'
                }),
            };
        }

        const existingTask = await getRecordById(taskId);
        if (!existingTask) {
            return {
                statusCode: 404,
                headers: getDefaultsHeaders(requestId),
                body: JSON.stringify({
                    message: 'Task not found'
                }),
            };
        }

        const updates: TaskUpdate = JSON.parse(event.body);
        const validationError = validateTaskUpdate(updates);

        if (validationError) {
            return {
                statusCode: 400,
                headers: getDefaultsHeaders(requestId),
                body: JSON.stringify({
                    message: validationError
                }),
            };
        }

        const updatedTask = await partialUpdateRecord(taskId, {
            ...updates,
            updatedAt: Date.now()
        });

        return {
            statusCode: 200,
            headers: getDefaultsHeaders(requestId),
            body: JSON.stringify({
                data: updatedTask
            }),
        };
    } catch (error) {
        console.error('Error updating task:', error);
        return {
            statusCode: 500,
            headers: getDefaultsHeaders(requestId),
            body: JSON.stringify({
                message: 'Internal server error',
                error: error instanceof Error ? error.message : 'Unknown error',
            })
        };
    }
}