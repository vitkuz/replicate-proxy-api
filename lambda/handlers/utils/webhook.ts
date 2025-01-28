import axios from 'axios';

const MAX_RETRIES = 3;
const INITIAL_DELAY = 1000; // 1 second

export async function sendWebhookNotification(url: string, payload: any): Promise<void> {
    let retries = 0;
    let delay = INITIAL_DELAY;

    while (retries < MAX_RETRIES) {
        try {
            await axios.post(url, payload, {
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 5000
            });
            return;
        } catch (error) {
            retries++;
            if (retries === MAX_RETRIES) {
                console.error(`Failed to send webhook notification after ${MAX_RETRIES} retries:`, error);
                throw error;
            }
            await new Promise(resolve => setTimeout(resolve, delay));
            delay *= 2; // Exponential backoff
        }
    }
}