import {APIGatewayProxyEvent, APIGatewayProxyResult} from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';
import { createRecord } from './services/dynamo';
import {Task, TaskInput, TaskStatus} from './types';
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

        const taskType = taskInput.taskType;
        const input = taskInput.input;

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
            taskType,
            status: TaskStatus.STARTING,
            webhookUrl: taskInput.webhookUrl,
            createdAt: now,
            updatedAt: now,
            input,
            // output: null
        };

        //todo: validate with zod

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