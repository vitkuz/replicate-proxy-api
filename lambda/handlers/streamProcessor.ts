import { DynamoDBStreamEvent } from 'aws-lambda';
import { Task, StreamEvent, TaskType, TaskStatus, StreamEventType } from './types';
import {unmarshall} from "@aws-sdk/util-dynamodb";
import {processReplicateTask} from "./tasks/processReplicate";
import {processElevenLabsTask} from "./tasks/processElevenlabs";
import {processChatGPTTask} from "./tasks/processChatGpt";

export async function handler(event: DynamoDBStreamEvent): Promise<void> {
    try {
        for (const record of event.Records) {
            // Skip if no new image data
            if (!record.dynamodb?.NewImage) continue;

            const streamEvent: StreamEvent = {
                eventName: record.eventName as StreamEventType,
                dynamodb: record.dynamodb || {}
            };

            const newTask = streamEvent.dynamodb.NewImage ? unmarshall(streamEvent.dynamodb.NewImage) as Task : null;
            const oldTask = streamEvent.dynamodb.OldImage ? unmarshall(streamEvent.dynamodb.OldImage) as Task : null;

            // Skip if task is already completed
            if (newTask && (newTask.status === TaskStatus.SUCCEEDED || newTask.status === TaskStatus.FAILED)) {
                console.log(`Skipping completed task ${newTask.id} with status ${newTask.status}`);
                continue;
            }

            if (streamEvent.eventName === StreamEventType.INSERT) {
                if (newTask) {
                    switch (newTask.taskType) {
                        case TaskType.REPLICATE:
                            await processReplicateTask(newTask);
                            break;
                        case TaskType.ELEVENLABS:
                            await processElevenLabsTask(newTask);
                            break;
                        case TaskType.CHATGPT:
                            await processChatGPTTask(newTask);
                            break;
                        default:
                            console.warn(`Unsupported task type: ${newTask.taskType}`);
                    }
                }
            }


            if (streamEvent.eventName === StreamEventType.MODIFY) {
                // Handle task modifications if needed
                console.log('Task modified:', { oldStatus: oldTask?.status, newStatus: newTask?.status });
            }

            if (streamEvent.eventName === StreamEventType.REMOVE) {
                console.log('Task removed:', oldTask?.id);
            }
        }
    } catch (error) {
        console.error('Error processing stream event:', error);
        throw error;
    }
}