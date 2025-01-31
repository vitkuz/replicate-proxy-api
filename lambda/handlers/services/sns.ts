import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { Task } from '../types';

const sns = new SNSClient({});
const TOPIC_ARN = process.env.TOPIC_ARN!;

export async function sendTaskNotification(task: Task): Promise<void> {
    console.log(`\n📩 Sending task notification: ${task.taskType}`);

    const message = JSON.stringify(task, null, 2);
    const attributes = {
        taskType: {
            DataType: 'String',
            StringValue: task.taskType
        },
        status: {
            DataType: 'String',
            StringValue: task.status
        }
    }

    console.log('message:', message);
    console.log('attributes:', attributes);

    try {
        await sns.send(new PublishCommand({
            TopicArn: TOPIC_ARN,
            Message: message,
            MessageAttributes: attributes
        }));
        console.log('✅ Task notification sent successfully');
    } catch (error) {
        console.error('❌ Error sending task notification:', error);
        throw error;
    }
}