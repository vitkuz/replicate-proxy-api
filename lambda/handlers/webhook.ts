import {APIGatewayProxyEvent, APIGatewayProxyResult} from 'aws-lambda';
import {v4 as uuidv4} from "uuid";
import {getDefaultsHeaders} from "./const";

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    console.log(JSON.stringify(event , null , 2))
    const requestId = uuidv4();
    try {
        // Log the entire request
        console.log('Webhook Request Headers:', JSON.stringify(event.headers, null, 2));
        console.log('Webhook Request Body:', event.body);
        console.log('Webhook HTTP Method:', event.httpMethod);
        console.log('Webhook Path Parameters:', event.pathParameters);
        console.log('Webhook Query Parameters:', event.queryStringParameters);

        return {
            statusCode: 200,
            headers: getDefaultsHeaders(requestId),
            body: JSON.stringify({
                data: null
            }),
        };
    } catch (error) {
        console.error('Error processing webhook:', error);
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