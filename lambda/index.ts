import {APIGatewayProxyEvent, APIGatewayProxyResult} from 'aws-lambda';
import {v4 as uuidv4} from 'uuid';
import {getJob, putJob} from './utils/dynamodb';
import {ReplicateRequest} from "./types";
import {startPrediction} from "./services/replicate";
import {DEFAULT_HEADERS, DEFAULT_INPUT_PARAMS, DEFAULT_REPLICATE_VERSION} from "./const";
import {Logger} from "./utils/logger";

async function recordJob(id: string, input: ReplicateRequest, output: unknown, status: string): Promise<void> {
  const log = new Logger({ functionName: 'recordJob', jobId: id });
  log.info('Recording job', { status });

  const now = Math.floor(Date.now() / 1000);
  // const ttl = now + (7 * 24 * 60 * 60); // 7 days retention

  await putJob({
    id,
    input,
    output,
    status,
    createdAt: now,
    // ttl,
  }).catch(error => {
    log.error('Failed to record job', error);
    throw error;
  });

  log.info('Successfully recorded job');
}

export const handler = async (
    event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const requestId = uuidv4();
  const log = new Logger({ functionName: 'handler', requestId });
  log.info('Request started', { httpMethod: event.httpMethod, path: event.path });

  const predictionId = event.queryStringParameters?.predictionId;

  try {
    // Get API token from SSM
    const apiToken = process.env.REPLICATE_API_TOKEN as string;

    if (!apiToken) {
      log.error('Missing API token');
      throw new Error('REPLICATE_API_TOKEN environment variable is not set');
    }

    // If predictionId is provided, get prediction status
    if (predictionId) {
      log.info('Getting job status', { predictionId });
      const job = await getJob(predictionId);

      if (!job) {
        log.warn('Job not found', { predictionId });
        return {
          statusCode: 404,
          headers: DEFAULT_HEADERS(requestId),
          body: JSON.stringify({
            error: `Job ${predictionId} not found`
          })
        };
      }

      log.info('Successfully retrieved job status', { status: job.status });
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
    log.info('Starting new prediction', { version: requestBody.version || DEFAULT_REPLICATE_VERSION });

    const replicateRequest: ReplicateRequest = {
      version: requestBody.version || DEFAULT_REPLICATE_VERSION,
      input: {
        ...DEFAULT_INPUT_PARAMS,
        ...requestBody.input,
      },
    };

    const predictionResponse = await startPrediction(apiToken, replicateRequest, requestId);
    log.info('Prediction started successfully', { predictionId: predictionResponse.id });

    try {
      await recordJob(predictionResponse.id, predictionResponse.input, predictionResponse.output, predictionResponse.status);
    } catch (error) {
      log.error('Failed to record job after successful prediction', error);
    }

    return {
      statusCode: 200,
      headers: DEFAULT_HEADERS(requestId),
      body: JSON.stringify(predictionResponse),
    };
  } catch (error) {
    log.error('Request failed', error);
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