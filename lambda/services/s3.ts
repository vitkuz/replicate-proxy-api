import {PutObjectCommand, S3Client} from "@aws-sdk/client-s3";
import axios from "axios";
import {v4 as uuidv4} from "uuid";
import {Logger} from "../utils/logger";

export const s3 = new S3Client({});
export const BUCKET_NAME = process.env.IMAGES_BUCKET!;
const logger = new Logger({ functionName: 's3' });

export function getDateBasedPath(): string {
    const now = new Date();
    return `${now.getUTCFullYear()}/${(now.getUTCMonth() + 1).toString().padStart(2, '0')}/${now.getUTCDate().toString().padStart(2, '0')}`;
}

export async function downloadAndUploadToS3(imageUrl: string, jobId: string): Promise<string> {
    const log = logger.withContext({ action: 'downloadAndUploadToS3', jobId });
    log.info('Starting image download and upload', { imageUrl });

    try {
        // Download image
        log.debug('Downloading image');
        const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
        const buffer = Buffer.from(response.data);

        // Generate unique filename with date-based path
        const extension = imageUrl.split('.').pop() || 'jpg';
        const filename = `${uuidv4()}.${extension}`;
        const datePath = getDateBasedPath();
        const key = `${datePath}/${filename}`;

        // Upload to S3
        log.debug('Uploading to S3', { key });
        await s3.send(new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key,
            Body: buffer,
            ContentType: `image/${extension}`,
        }));

        log.info('Successfully uploaded image to S3', { key });
        // Return S3 URL
        return `s3://${BUCKET_NAME}/${key}`;
    } catch (error) {
        log.error('Failed to process image', error);
        throw error;
    }
}