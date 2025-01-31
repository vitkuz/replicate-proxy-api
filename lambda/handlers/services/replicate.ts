import {Task} from "../types";
import axios from "axios";
import {v4} from "uuid";
import {PutObjectCommand, S3Client} from "@aws-sdk/client-s3";

const Replicate = require('replicate');
const path = require('path');
const fs = require('fs');

const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN!;
const AWS_REGION = process.env.AWS_REGION!;
const BUCKET_NAME = process.env.BUCKET_NAME!;

const replicate = new Replicate({
    auth: REPLICATE_API_TOKEN,
});

const s3Client = new S3Client({
    region: AWS_REGION,
});

// Enum for Supported MIME Types
enum MimeType {
    JPG = "image/jpeg",
    JPEG = "image/jpeg",
    PNG = "image/png",
    WEBP = "image/webp",
    GIF = "image/gif",
    MP3 = "audio/mpeg",
    MP4 = "video/mp4",
}

// Define Supported File Extensions
type FileExtension = keyof typeof MimeType;

// utility function to get content type based on file extension
function getContentType(extension: string): string {
    const key = extension.toUpperCase().replace(".", "") as FileExtension;
    return MimeType[key] || "application/octet-stream"; // Default if unknown
}

export async function saveReplicationVideoLocally(replicateResponse: ReadableStream): Promise<{ filename: string; ext: string }[]> {
    if (!replicateResponse) {
        throw new Error("No valid valid response.");
    }

    const savedFiles: { filename: string; ext: string }[] = [];

    const response = new Response(replicateResponse);

    const buffer = Buffer.from(await response.arrayBuffer());

    // Save the file synchronously
    const filename = `/tmp/output_${v4()}.mp4`;
    fs.writeFileSync(filename, buffer);

    console.log(`File saved successfully as ${filename}`);
    savedFiles.push({ filename, ext: '.mp4' });

    return savedFiles;
}

// Function to Save Files Locally
export async function saveReplicationFilesLocally(replicateResponse: string[]): Promise<{ filename: string; ext: string }[]> {
    if (!replicateResponse) {
        throw new Error("No valid valid response.");
    }

    const output = Array.isArray(replicateResponse) ? replicateResponse : [replicateResponse];
    const savedFiles: { filename: string; ext: string }[] = [];

    for (let i = 0; i < output.length; i++) {
        const fileUrl = output[i];
        try {
            console.log(`Downloading file ${i + 1}: ${fileUrl}`);

            console.log(path)

            // Get the file extension from the URL
            console.log(
                `URL: ${new URL(fileUrl).pathname}`,
                `Ext: ${path.extname(new URL(fileUrl).pathname)}`
            )
            let ext = path.extname(new URL(fileUrl).pathname);
            if (!ext) ext = ".jpg"; // Default to jpg if no extension is found

            // Fetch file data
            const response = await axios.get(fileUrl, { responseType: "arraybuffer" });

            // Save the file with a unique filename
            // Save file in /tmp (Lambda's writable directory)
            const filename = `/tmp/output_${v4()}${ext}`;
            fs.writeFileSync(filename, response.data);

            console.log(`File saved successfully as ${filename}`);
            savedFiles.push({ filename, ext });
        } catch (error) {
            console.error(`Error downloading file ${i + 1}:`, error);
            throw error;
        }
    }

    return savedFiles;
}


// Upload images/audio/video to AWS S3 and return S3 URLs
// Function to Upload Files to AWS S3
export async function saveReplicationFilesToS3(files: { filename: string; ext: string }[]): Promise<string[]> {
    if (files.length === 0) {
        throw new Error("No files to upload.");
    }

    const uploadedUrls: string[] = [];

    for (const { filename, ext } of files) {
        try {
            const fileStream = fs.readFileSync(filename);
            const contentType = getContentType(ext);

            const uploadParams = {
                Bucket: BUCKET_NAME,
                Key: `replicate_outputs/${path.basename(filename)}`, // Store in a folder
                Body: fileStream,
                ContentType: contentType,
            };

            console.log(`Uploading ${filename} to S3...`);
            await s3Client.send(new PutObjectCommand(uploadParams));

            // Construct public S3 URL
            const fileUrl = `https://${BUCKET_NAME}.s3.${AWS_REGION}.amazonaws.com/${uploadParams.Key}`;
            console.log(`Uploaded: ${fileUrl}`);
            uploadedUrls.push(fileUrl);

            // Delete local file after upload
            fs.unlinkSync(filename);
            console.log(`Deleted local file: ${filename}`);
        } catch (error) {
            console.error(`Error uploading ${filename} to S3:`, error);
            throw error;
        }
    }

    return uploadedUrls;
}

export async function getReplicateResponse(task: Task): Promise<unknown> {
    try {
        const { version, input } = task.input;
        return await replicate.run(version, {input});
    } catch (error) {
        console.error('Error getting Replicate response:', error);
        throw error;
    }
}