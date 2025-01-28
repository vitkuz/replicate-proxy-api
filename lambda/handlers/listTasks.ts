import {APIGatewayProxyEvent, APIGatewayProxyResult} from 'aws-lambda';
import { getAllRecords } from './services/dynamo';
import {getDefaultsHeaders} from "./const";
import {v4 as uuidv4} from "uuid";

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    console.log(JSON.stringify(event , null , 2))
    const requestId = uuidv4();
    try {
        const tasks = await getAllRecords();

        return {
            statusCode: 200,
            headers: getDefaultsHeaders(requestId),
            body: JSON.stringify(tasks),
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