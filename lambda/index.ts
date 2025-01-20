import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import {SSMClient, GetParameterCommand} from '@aws-sdk/client-ssm';
import axios from 'axios';
import {v4 as uuidv4} from 'uuid';
import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';

const REPLICATE_API_BASE = 'https://api.replicate.com/v1';

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

const dynamodb = new DynamoDBClient({});
const ssm = new SSMClient({});
let cachedApiToken: string | undefined;

async function recordJob(id: string, input: ReplicateRequest, output: unknown): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const ttl = now + (7 * 24 * 60 * 60); // 7 days retention

  const item = {
    id,
    input,
    output: output,
    createdAt: now,
    ttl,
  };

  await dynamodb.send(new PutItemCommand({
    TableName: process.env.REPLICATE_PROXY_TABLE,
    Item: marshall(item),
  }));
}

async function getApiToken(): Promise<string> {
  if (cachedApiToken) {
    return cachedApiToken;
  }

  const parameterResponse = await ssm.send(
      new GetParameterCommand({
        Name: process.env.REPLICATE_API_TOKEN,
        WithDecryption: true,
      })
  );

  if (!parameterResponse.Parameter?.Value) {
    throw new Error('API token not found');
  }

  cachedApiToken = parameterResponse.Parameter.Value;
  return cachedApiToken as string;
}

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

async function getPredictionStatus(apiToken: string, predictionId: string, requestId: string): Promise<ReplicateResponse> {
  return (await axios.get(
      `${REPLICATE_API_BASE}/predictions/${predictionId}`,
      {
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'X-Request-ID': requestId,
          'X-Proxy-Timestamp': new Date().toISOString(),
        },
      }
  )).data;
}

// async function waitForCompletion(apiToken: string, predictionId: string, requestId: string): Promise<ReplicateResponse> {
//   const maxAttempts = 60; // 30 seconds total (500ms * 60)
//   let attempts = 0;
//
//   while (attempts < maxAttempts) {
//     const status = await getPredictionStatus(apiToken, predictionId, requestId);
//
//     if (status.status === 'succeeded' || status.status === 'failed') {
//       return status;
//     }
//
//     await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 500ms between checks
//     attempts++;
//   }
//
//   throw new Error('Prediction timed out');
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
    const apiToken = await getApiToken();

    // If predictionId is provided, get prediction status
    if (predictionId) {
      const statusResponse = await getPredictionStatus(apiToken, predictionId, requestId);
      console.log(JSON.stringify(statusResponse, null , 2));
      try {
        await recordJob(statusResponse.id, statusResponse.input, statusResponse.output);
      } catch (error) {
        console.log(error);
      }

      return {
        statusCode: 200,
        headers: DEFAULT_HEADERS(requestId),
        body: JSON.stringify(statusResponse),
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
      await recordJob(predictionResponse.id, predictionResponse.input, predictionResponse.output);
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