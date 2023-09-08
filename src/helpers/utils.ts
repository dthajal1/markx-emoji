// Helper functions
import { getEnvVar } from "@collabland/common";
import AWS from "aws-sdk";
import crypto from "crypto";

const s3 = new AWS.S3();

export interface Product {
    name: string
    description: string
    mergedImgUrl: string
    images: string[]
}

export const PRIMARY_COLOR = 0x667eea;

export async function uploadToS3(name: string, buffer: Buffer): Promise<string> {
    // Upload the merged image data to S3
    const uploadParams = {
        Bucket: process.env.S3_BUCKET || "markx-bucket", // TODO: change this
        Key: `${name}.jpg`, // Change the key as needed
        Body: buffer,
        // ACL: "public-read", // Set ACL for public access if needed
        ContentType: "image/jpeg", // Adjust content type as needed
    };
    const uploadResult = await s3.upload(uploadParams).promise();
    // console.log("Upload to s3 successful");

    // Create the S3 URL for the merged image
    const s3ImageUrl = uploadResult.Location;

    return s3ImageUrl
}

export function generateStateString(length: number): string {
    const bytes = crypto.randomBytes(Math.ceil(length / 2));
    return bytes.toString('hex').slice(0, length);
}

export function createEmbed(selectedProduct: Product) {
    return {
        title: selectedProduct.name,
        description: selectedProduct.description,
        color: PRIMARY_COLOR,
        image: {
            url: selectedProduct.mergedImgUrl,
            height: 0,
            width: 0,
        },
        footer: {
            text: "Created with ❤️ by MarkX",
            icon_url: `${getEnvVar('BASE_URL')}/MarkX_Logo.png`,
        },
    };
}

export function capitalizeWords(inputString: string) {
    const words = inputString.split(' ');
    const capitalizedWords = words.map((word: string) => {
        if (word.length > 0) {
            return word.charAt(0).toUpperCase() + word.slice(1);
        } else {
            return word;
        }
    });
    const resultString = capitalizedWords.join(' ');
    return resultString;
}

export function sanitizeNumber(number: number) {
    if (!isNaN(number) && number >= 0 && number <= 9) {
        // If it's a single digit (0-9), add a leading '0'
        return `0${number}`;
    } else {
        // Otherwise, keep it as is
        return number;
    }
}