import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import {SSMClient, GetParameterCommand} from '@aws-sdk/client-ssm';
import axios from 'axios';
import {v4 as uuidv4} from 'uuid';
import {getJob, putJob} from './utils/dynamodb';

const REPLICATE_API_BASE =  process.env.REPLICATE_API_BASE || 'https://api.replicate.com/v1';

const DEFAULT_HEADERS = (requestId: string) => ({
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'OPTIONS,POST',
  'X-Request-ID': requestId,
  'X-Proxy-Timestamp': new Date().toISOString(),
});

const DEFAULT_REPLICATE_VERSION = '70a95a700a394552368f765fee2e22aa77d6addb933ba3ad914683c5e11940e1';

const DEFAULT_INPUT_PARAMS: ReplicateInput = {
  model: 'dev',
  go_fast: false,
  lora_scale: 1,
  megapixels: '1',
  num_outputs: 1,
  aspect_ratio: '1:1',
  output_format: 'jpg',
  guidance_scale: 3,
  output_quality: 80,
  prompt_strength: 0.8,
  extra_lora_scale: 1,
  num_inference_steps: 28,
};

interface ReplicateInput {
  model: string;
  go_fast: boolean;
  lora_scale: number;
  megapixels: string;
  num_outputs: number;
  aspect_ratio: string;
  output_format: string;
  guidance_scale: number;
  output_quality: number;
  prompt_strength: number;
  extra_lora_scale: number;
  num_inference_steps: number;
  [key: string]: unknown; // Allow additional properties
}

interface ReplicateRequest {
  version: string;
  input: ReplicateInput;
}

interface ReplicateResponse {
  input: ReplicateRequest;
  id: string;
  status: 'starting' | 'processing' | 'succeeded' | 'failed';
  output?: unknown;
  error?: string;
}

// const ssm = new SSMClient({});
// let cachedApiToken: string | undefined;

async function recordJob(id: string, input: ReplicateRequest, output: unknown, status: string): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const ttl = now + (7 * 24 * 60 * 60); // 7 days retention

  await putJob({
    id,
    input,
    output,
    status,
    createdAt: now,
    // ttl,
  });
}

// do not delete move into separate
// async function getApiToken(): Promise<string> {
//   if (cachedApiToken) {
//     return cachedApiToken;
//   }
//
//   const parameterResponse = await ssm.send(
//       new GetParameterCommand({
//         Name: process.env.REPLICATE_API_TOKEN,
//         WithDecryption: true,
//       })
//   );
//
//   if (!parameterResponse.Parameter?.Value) {
//     throw new Error('API token not found');
//   }
//
//   cachedApiToken = parameterResponse.Parameter.Value;
//   return cachedApiToken as string;
// }

async function startPrediction(apiToken: string, replicateRequest: ReplicateRequest, requestId: string): Promise<ReplicateResponse> {
  return (await axios.post(
      `${REPLICATE_API_BASE}/predictions`,
      replicateRequest,
      {
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
          'X-Request-ID': requestId,
          'X-Proxy-Timestamp': new Date().toISOString(),
        },
      }
  )).data;
}

// todo: do not delete, move it in service
// async function getPredictionStatus(apiToken: string, predictionId: string, requestId: string): Promise<ReplicateResponse> {
//   return (await axios.get(
//       `${REPLICATE_API_BASE}/predictions/${predictionId}`,
//       {
//         headers: {
//           Authorization: `Bearer ${apiToken}`,
//           'X-Request-ID': requestId,
//           'X-Proxy-Timestamp': new Date().toISOString(),
//         },
//       }
//   )).data;
// }

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