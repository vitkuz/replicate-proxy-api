import { DynamoDBStreamEvent } from 'aws-lambda';
import { Task, StreamEvent, TaskType, TaskStatus, StreamEventType } from './types';
import {unmarshall} from "@aws-sdk/util-dynamodb";
// import {processReplicateTask} from "./tasks/processReplicate";
import {processElevenLabsTask} from "./tasks/processElevenlabs";
import {processChatGPTTask} from "./tasks/processChatGpt";
// import {processMinimaxVideoTask} from "./tasks/processMinimaxVideo";
// import {processDeepSeekR1Task} from "./tasks/processDeepSeekR1";
// import {processKlingProTask} from "./tasks/processKlingPro";
import {processReplicateImagesTask} from "./tasks/processReplicateImages";
import {processReplicateText} from "./tasks/processReplicateText";
import {processReplicateVideo} from "./tasks/processReplicateVideo";

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
            if (newTask && (newTask.status !== TaskStatus.STARTING)) {
                console.log(`Skipping completed task ${newTask.id} with status ${newTask.status}`);
                continue;
            }

            if (streamEvent.eventName === StreamEventType.INSERT) {
                if (newTask) {
                    switch (newTask.taskType) {
                        case TaskType.REPLICATE_IMAGES:
                            await processReplicateImagesTask(newTask);
                            break;
                        case TaskType.REPLICATE_VIDEOS:
                            await processReplicateVideo(newTask);
                            break;
                        case TaskType.REPLICATE_TEXT:
                            await processReplicateText(newTask);
                            break;
                        case TaskType.ELEVENLABS:
                            await processElevenLabsTask(newTask);
                            break;
                        case TaskType.CHATGPT:
                            await processChatGPTTask(newTask);
                            break;
                        // case TaskType.REPLICATE_MINIMAX_VIDEO:
                        //     await processMinimaxVideoTask(newTask);
                        //     break;
                        // case TaskType.REPLICATE_DEEP_SEEK_R1:
                        //     await processDeepSeekR1Task(newTask);
                        //     break;
                        // case TaskType.BLACK_FOREST_LABS_FLUX_PRO:
                        //     await processReplicateTask(newTask);
                        //     break;
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
    }
}