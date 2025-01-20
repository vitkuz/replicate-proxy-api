import {ReplicateRequest, ReplicateResponse} from "../types";
import axios from "axios";
import {Logger} from "../utils/logger";

const REPLICATE_API_BASE =  process.env.REPLICATE_API_BASE || 'https://api.replicate.com/v1';
const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN!;
const logger = new Logger({ functionName: 'replicate' });

export async function getPredictionStatus(predictionId: string): Promise<ReplicateResponse> {
    const log = logger.withContext({ action: 'getPredictionStatus', jobId: predictionId });
    log.info('Getting prediction status');

    const response = await axios.get(
        `${REPLICATE_API_BASE}/predictions/${predictionId}`,
        {
            headers: {
                Authorization: `Bearer ${REPLICATE_API_TOKEN}`,
            },
        }
    ).catch(error => {
        log.error('Failed to get prediction status', error);
        throw error;
    });

    log.info('Successfully retrieved prediction status', { status: response.data.status });
    return response.data;
}

export async function startPrediction(apiToken: string, replicateRequest: ReplicateRequest, requestId: string): Promise<ReplicateResponse> {
    const log = logger.withContext({ action: 'startPrediction', requestId });
    log.info('Starting prediction', { version: replicateRequest.version });

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
    ).catch(error => {
        log.error('Failed to start prediction', error);
        throw error;
    })).data;
}