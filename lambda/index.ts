import {APIGatewayProxyEvent, APIGatewayProxyResult} from 'aws-lambda';
import {v4 as uuidv4} from 'uuid';
import {getJob, putJob} from './utils/dynamodb';
import {ReplicateRequest} from "./types";
import {startPrediction} from "./services/replicate";
import {DEFAULT_HEADERS, DEFAULT_INPUT_PARAMS, DEFAULT_REPLICATE_VERSION} from "./const";

async function recordJob(id: string, input: ReplicateRequest, output: unknown, status: string): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  // const ttl = now + (7 * 24 * 60 * 60); // 7 days retention

  await putJob({
    id,
    input,
    output,
    status,
    createdAt: now,
    // ttl,
  });
}

export const handler = async (
    event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  console.log(JSON.stringify(event, null , 2))
  const requestId = uuidv4();
  console.log(`Request started: ${requestId}`);

  const predictionId = event.queryStringParameters?.predictionId;

  try {
    // Get API token from SSM
    const apiToken = process.env.REPLICATE_API_TOKEN as string;

    if (!apiToken) {
      throw new Error('REPLICATE_API_TOKEN environment variable is not set');
    }

    // If predictionId is provided, get prediction status
    if (predictionId) {
      const job = await getJob(predictionId);
      console.log(JSON.stringify(job, null , 2))

      if (!job) {
        return {
          statusCode: 404,
          headers: DEFAULT_HEADERS(requestId),
          body: JSON.stringify({
            error: `Job ${predictionId} not found`
          })
        };
      }

      return {
        statusCode: 200,
        headers: DEFAULT_HEADERS(requestId),
        body: JSON.stringify({
          input: job.input,
          id: job.id,
          status: job.status,
          output: job.output,
          error: job.error,
          images: job.images,
        })
      };
    }

    // Start new prediction
    const requestBody = event.body ? JSON.parse(event.body) : {};

    const replicateRequest: ReplicateRequest = {
      version: requestBody.version || DEFAULT_REPLICATE_VERSION,
      input: {
        ...DEFAULT_INPUT_PARAMS,
        ...requestBody.input,
      },
    };

    const predictionResponse = await startPrediction(apiToken, replicateRequest, requestId);
    console.log(JSON.stringify(predictionResponse, null , 2));
    try {
      await recordJob(predictionResponse.id, predictionResponse.input, predictionResponse.output, predictionResponse.status);
    } catch (error) {
      console.log(error);
    }

    return {
      statusCode: 200,
      headers: DEFAULT_HEADERS(requestId),
      body: JSON.stringify(predictionResponse),
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers: DEFAULT_HEADERS(requestId),
      body: JSON.stringify({
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};