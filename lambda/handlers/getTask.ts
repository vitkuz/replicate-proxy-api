import {APIGatewayProxyEvent, APIGatewayProxyResult} from 'aws-lambda';
import { getRecordById } from './services/dynamo';
import {v4 as uuidv4} from "uuid";
import {getDefaultsHeaders} from "./const";

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    console.log(JSON.stringify(event , null , 2))
    const requestId = uuidv4();
    try {
        const taskId = event.pathParameters?.id;

        if (!taskId) {
            return {
                statusCode: 400,
                headers: getDefaultsHeaders(requestId),
                body: JSON.stringify({
                    message: 'Task ID is required'
                }),
            };
        }

        const task = await getRecordById(taskId);

        if (!task) {
            return {
                statusCode: 404,
                headers: getDefaultsHeaders(requestId),
                body: JSON.stringify({
                    message: 'Task not found'
                }),
            };
        }

        return {
            statusCode: 200,
            headers: getDefaultsHeaders(requestId),
            body: JSON.stringify({
                data: task
            }),
        };

    } catch (error) {
        console.error('Error retrieving task:', error);
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