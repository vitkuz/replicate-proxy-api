import {APIGatewayProxyEvent, APIGatewayProxyResult} from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';
import { createRecord } from './services/dynamo';
import { Task, TaskInput } from './types';
import { validateTaskInput } from './utils/validation';
import {getDefaultsHeaders} from "./const";

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    console.log(JSON.stringify(event , null , 2))
    const requestId = uuidv4();
    try {
        if (!event.body) {
            return {
                statusCode: 400,
                headers: getDefaultsHeaders(requestId),
                body: JSON.stringify({
                    message: 'Request body is required'
                }),
            };
        }

        const taskInput: TaskInput = JSON.parse(event.body);
        const validationError = validateTaskInput(taskInput);

        if (validationError) {

            return {
                statusCode: 400,
                headers: getDefaultsHeaders(requestId),
                body: JSON.stringify({
                    message: validationError
                }),
            };
        }

        const now = Date.now();
        const task: Task = {
            id: uuidv4(),
            taskType: 'replicate',
            status: 'starting',
            createdAt: now,
            updatedAt: now,
            input: taskInput.input,
            webhookUrl: taskInput.webhookUrl,
            // output: null
        };

        await createRecord(task);

        return {
            statusCode: 201,
            headers: getDefaultsHeaders(requestId),
            body: JSON.stringify({
                data: task
            }),
        };
    } catch (error) {
        console.error('Error listing tasks:', error);
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