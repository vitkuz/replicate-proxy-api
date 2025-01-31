import axios from 'axios';
import { Task } from '../types';

const MAX_RETRIES = 3;
const INITIAL_DELAY = 1000; // 1 second

export async function sendWebhookNotification(task: Task): Promise<void> {
    if (!task.webhookUrl) return;

    let retries = 0;
    let delay = INITIAL_DELAY;

    const payload = {
        taskId: task.id,
        status: task.status,
        taskType: task.taskType,
        output: task.output,
        error: task.error,
        timestamp: new Date().toISOString()
    };

    while (retries < MAX_RETRIES) {
        try {
            await axios.post(task.webhookUrl, payload, {
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 5000
            });
            return;
        } catch (error) {
            retries++;
            if (retries === MAX_RETRIES) {
                throw error;
            }
            await new Promise(resolve => setTimeout(resolve, delay));
            delay *= 2; // Exponential backoff
        }
    }
}