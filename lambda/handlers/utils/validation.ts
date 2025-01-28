import { TaskInput, TaskUpdate } from '../types';

export function validateTaskInput(input: TaskInput): string | null {
    if (!input.taskType || typeof input.taskType !== 'string') {
        return 'taskType is required and must be a string';
    }

    if (!input.input || typeof input.input !== 'object') {
        return 'input is required and must be an object';
    }

    if (input.webhookUrl && typeof input.webhookUrl !== 'string') {
        return 'webhookUrl must be a string';
    }

    return null;
}

export function validateTaskUpdate(update: TaskUpdate): string | null {
    if (update.taskType && typeof update.taskType !== 'string') {
        return 'taskType must be a string';
    }

    if (update.status && typeof update.status !== 'string') {
        return 'status must be a string';
    }

    if (update.payload && typeof update.payload !== 'object') {
        return 'payload must be an object';
    }

    if (update.webhookUrl && typeof update.webhookUrl !== 'string') {
        return 'webhookUrl must be a string';
    }

    return null;
}