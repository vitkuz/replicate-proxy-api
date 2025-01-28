import { DynamoDBStreamEvent } from 'aws-lambda';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { Task, StreamEvent } from './types';
import {unmarshall} from "@aws-sdk/util-dynamodb";

import {getS3Url, putObject} from "./services/s3";
// import {AttributeValue} from "@aws-sdk/client-dynamodb";
// import {generateImageAndSave} from "./services/replicate";
import axios from "axios";
import {v4 as uuidv4} from "uuid";
import {partialUpdateRecord} from "./services/dynamo";
// import { sendWebhookNotification } from './utils/webhook';

const Replicate = require('replicate');

const TOPIC_ARN = process.env.TOPIC_ARN!;
const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN!;
const REPLICATE_MODEL_ID = 'vitkuz/lily:70a95a700a394552368f765fee2e22aa77d6addb933ba3ad914683c5e11940e1';

const snsClient = new SNSClient({});
const replicate = new Replicate({
    auth: REPLICATE_API_TOKEN,
});



// add insert handler
// add modify handler

// get type of the task, match it with handler
// for example send request to replicate and start polling

export async function handler(event: DynamoDBStreamEvent): Promise<void> {
    try {
        for (const record of event.Records) {
            const streamEvent: StreamEvent = {
                eventName: record.eventName as StreamEvent['eventName'],
                dynamodb: record.dynamodb || {}
            };

            const newTask = streamEvent.dynamodb.NewImage ? unmarshall(streamEvent.dynamodb.NewImage) as Task : null;
            const oldTask = streamEvent.dynamodb.OldImage ? unmarshall(streamEvent.dynamodb.OldImage) as Task : null;

            // Publish to SNS
            // await snsClient.send(new PublishCommand({
            //     TopicArn: TOPIC_ARN,
            //     Message: JSON.stringify({
            //         newTask,
            //         oldTask
            //     }),
            //     MessageAttributes: {
            //         eventType: {
            //             DataType: 'String',
            //             StringValue: streamEvent.eventName
            //         }
            //     }
            // }));

            if (streamEvent.eventName === 'INSERT') {
                console.log('task was created', newTask, oldTask)

                if (newTask) {
                    const prompt = newTask.input.promt|| 'LILY in Paris';
                    // status: 'starting' | 'processing' | 'succeeded' | 'failed';
                    await partialUpdateRecord(newTask.id, {
                        status: 'processing',
                        updatedAt: Date.now()
                    });
                    const output = await replicate.run(
                        REPLICATE_MODEL_ID,
                        {
                            input: {
                                model: 'dev',
                                go_fast: false,
                                lora_scale: 1,
                                megapixels: '1',
                                num_outputs: 1,
                                aspect_ratio: '9:16',
                                output_format: 'jpg',
                                guidance_scale: 3,
                                output_quality: 100,
                                prompt_strength: 0.8,
                                extra_lora_scale: 1,
                                num_inference_steps: 28,
                                prompt
                            }
                        }
                    );

                    if (!output || !Array.isArray(output)) {
                        throw new Error('Invalid response from Replicate');
                    }

                    const s3Keys = [];

                    for (const [index, url] of output.entries()) {
                        try {
                            const response = await axios.get(url, { responseType: 'arraybuffer' });
                            const imageBuffer = Buffer.from(response.data);
                            const s3Key = `${uuidv4()}.jpg`;

                            await putObject(s3Key, imageBuffer, {
                                contentType: 'image/jpeg',
                                metadata: {
                                    'generated-by': 'replicate',
                                    'model-id': REPLICATE_MODEL_ID,
                                    'imagePrompt': prompt,
                                    'generation-date': new Date().toISOString()
                                }
                            });

                            s3Keys.push(s3Key);
                        } catch (error) {
                            console.error('Error saving image to S3:', error);
                            // throw error;
                        }
                    }

                    const images = s3Keys.map(s3Key => {
                        return getS3Url(s3Key)
                    })

                    await partialUpdateRecord(newTask.id, {
                        status: 'succeeded',
                        output: images,
                        updatedAt: Date.now()
                    });

                    // record images field

                }

                // make request to replicate
            }

            if (streamEvent.eventName === 'MODIFY') {
                console.log('task was updated', newTask, oldTask)
            }

            // Send webhook notification if URL exists
            if (streamEvent.eventName !== 'REMOVE') {
                console.log('task was removed', newTask, oldTask)
            }
        }
    } catch (error) {
        console.error('Error processing stream event:', error);
        throw error;
    }
}