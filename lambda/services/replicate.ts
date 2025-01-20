import {ReplicateRequest, ReplicateResponse} from "../types";
import axios from "axios";

const REPLICATE_API_BASE =  process.env.REPLICATE_API_BASE || 'https://api.replicate.com/v1';
const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN!;

export async function getPredictionStatus(predictionId: string): Promise<ReplicateResponse> {
    const response = await axios.get(
        `${REPLICATE_API_BASE}/predictions/${predictionId}`,
        {
            headers: {
                Authorization: `Bearer ${REPLICATE_API_TOKEN}`,
            },
        }
    );
    console.log('getPredictionStatus',JSON.stringify(response.data), null, 2)
    return response.data;
}

export async function startPrediction(apiToken: string, replicateRequest: ReplicateRequest, requestId: string): Promise<ReplicateResponse> {
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