// MergeImagesController.ts

import { api, post, requestBody } from '@loopback/rest';
import { CanvasRenderingContext2D, createCanvas, loadImage, registerFont } from "canvas";
import { dirname, join } from "path";
import { fileURLToPath } from 'url';
import { sanitizeNumber, uploadToS3 } from '../helpers/utils.js';


@api({ basePath: '/api/images' })
export class ImagesController {
    constructor() { }

    @post('/merge')
    async handleMerge(
        @requestBody({
            content: {
                'application/json': {
                    schema: {
                        type: 'object',
                        properties: {
                            imgName: {
                                type: 'string'
                            },
                            imageUrls: {
                                type: 'array',
                                items: {
                                    type: 'string',
                                },
                            },
                        },
                        required: ['imgName', 'imageUrls'],
                    },
                },
            },
        })
        data: { imgName: string, imageUrls: string[] },
    ): Promise<string> {
        const { imgName, imageUrls } = data;

        // TODO: remove this after emoji names are added
        const updatedImgUrls = await Promise.all(imageUrls.map(async (imgUrl, idx) => {
            const txt = `${sanitizeNumber(idx + 1)}`;
            const canvas = await this.writeTxtOnImg(txt, imgUrl, true);
            const buffer = canvas.toBuffer();
            const updatedImgUrl = await uploadToS3(`${imgName}-${txt}`, buffer);
            return updatedImgUrl
        }))

        const canvas = await this.mergeImgs(updatedImgUrls)
        const buffer = canvas.toBuffer();
        const s3ImageUrl = await uploadToS3(`${imgName}-merged-image`, buffer);
        return s3ImageUrl
    }

    @post('/addTxt')
    async handleAddTxt(
        @requestBody({
            content: {
                'application/json': {
                    schema: {
                        type: 'object',
                        properties: {
                            imgName: {
                                type: 'string'
                            },
                            imgUrl: {
                                type: 'string'
                            },
                            txt: {
                                type: 'string'
                            }
                        },
                        required: ['imgName', 'imgUrl', 'txt'],
                    },
                },
            },
        })
        data: { imgName: string, imgUrl: string, txt: string },
    ): Promise<string> {
        console.log()
        const { imgName, imgUrl, txt } = data;
        const canvas = await this.writeTxtOnImg(txt, imgUrl, false);
        const buffer = canvas.toBuffer();
        const s3ImageUrl = await uploadToS3(`${imgName}-${txt}`, buffer); // TODO: auto delete after certain time?? 
        return s3ImageUrl
    }

    // @post('/addTxt')
    // async handleAddTxt(
    //     @requestBody({
    //         content: {
    //             'application/json': {
    //                 schema: {
    //                     type: 'object',
    //                     properties: {
    //                         imgName: {
    //                             type: 'string'
    //                         },
    //                         imageUrls: {
    //                             type: 'array',
    //                             items: {
    //                                 type: 'string',
    //                             },
    //                         },
    //                         names: {
    //                             type: 'array',
    //                             items: {
    //                                 type: 'string',
    //                             },
    //                         },
    //                     },
    //                     required: ['imgName', 'imageUrls', 'names'],
    //                 },
    //             },
    //         },
    //     })
    //     data: { imgName: string, imageUrls: string[]; names: string[] },
    // ): Promise<string[]> {
    //     const { imgName, imageUrls, names } = data;

    //     const result: string[] = []
    //     for (let i = 0; i < imageUrls.length; i++) {
    //         const canvas = await this.writeTxtOnImg(names[i], imageUrls[i]);
    //         const buffer = canvas.toBuffer();
    //         const s3ImageUrl = await uploadToS3(`${imgName}-${names[i]}`, buffer);
    //         result.push(s3ImageUrl)
    //     }

    //     return result

    // }

    private async mergeImgs(imageUrls: string[]) {
        // merge imgs (at max 12) into a single image
        const canvasWidth = 800; // Adjust canvas dimensions as needed
        const canvasHeight = 800;
        const canvas = createCanvas(canvasWidth, canvasHeight);
        const ctx = canvas.getContext('2d');

        // Load and draw images on the canvas
        const images = await Promise.all(imageUrls.map(async (img) => {
            const image = await loadImage(img); // Load the image using loadImage
            return image;
        }));

        // Define grid dimensions
        const maxCols = 4; // Maximum number of columns
        const cellWidth = canvasWidth / maxCols;
        const cellHeight = cellWidth; // To keep images square

        // Calculate the number of rows and columns
        const numImages = images.length;
        const cols = Math.min(numImages, maxCols);
        const rows = Math.ceil(numImages / cols);

        // Calculate the total height occupied by images in the grid
        const gridHeight = rows * cellHeight;

        // Calculate padding to center the grid vertically
        const paddingTop = (canvasHeight - gridHeight) / 2;

        // Calculate horizontal padding
        const paddingX = (canvasWidth - cols * cellWidth) / 2;

        // Draw images on the canvas in a grid with centered vertical and horizontal alignment
        images.forEach((image, index) => {
            const col = index % cols;
            const row = Math.floor(index / cols);
            const x = paddingX + col * cellWidth;
            const y = paddingTop + row * cellHeight;
            ctx.drawImage(image, x, y, cellWidth, cellHeight);
        });

        return canvas
    }

    private async writeTxtOnImg(text: string, imageUrl: string, isTopLeft: boolean) {
        // Load the Google Font
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = dirname(__filename);
        const fontPath = join(__dirname, '../../public/fonts/Caprasimo-Regular.ttf');
        registerFont(fontPath, { family: "Caprasimo" });

        // Load the image using canvas
        const image = await loadImage(imageUrl);

        const canvas = createCanvas(image.width, image.height);
        const ctx = canvas.getContext("2d");

        // Draw the image onto the canvas
        ctx.drawImage(image, 0, 0, image.width, image.height);

        let fontSize = 70;
        if (isTopLeft) {
            fontSize = 120;
        }
        const fontWeight = "bold";
        ctx.font = `${fontWeight} ${fontSize}px 'Caprasimo', cursive`;

        // Get the color of the pixel at the center of the image
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const [r, g, b] = ctx.getImageData(centerX, centerY, 1, 1).data;

        // Use the sampled color for the font
        let fontColor = `rgb(${r * (1 - 0.01)}, ${g * (1 - 0.01)}, ${b * (1 - 0.01)})`;
        if (isTopLeft) {
            fontColor = 'white'
        }
        ctx.fillStyle = fontColor;

        // Horizontal alignment
        ctx.textAlign = "center";
        if (isTopLeft) {
            ctx.textAlign = "start"
        }

        // Vertical alignment on the top with a margin
        const textY = 0; // Adjust the margin as needed
        ctx.textBaseline = "top";


        // Set the text border style
        ctx.strokeStyle = "white"; // Border color
        ctx.lineWidth = 10; // Border thickness
        if (isTopLeft) {
            ctx.strokeStyle = "black"; // Border color
            ctx.lineWidth = 30;
        }

        if (isTopLeft) {
            // Draw the text with a border
            const line = text; // Single line of text
            const lineHeight = fontSize - 20;

            // Introduce a random rotation angle (in radians)
            const rotation = (Math.random() - 0.5) * Math.PI / 20; // Adjust the angle as needed

            // Save the current canvas state
            ctx.save();

            // Translate to the position of the text and apply rotation
            ctx.translate(canvas.width / 2, textY);
            ctx.rotate(rotation);

            // Draw the text at the calculated position with rotation
            ctx.strokeText(line, 0, 0); // Draw the text
            ctx.fillText(line, 0, 0);

            // Restore the canvas state to undo the rotation
            ctx.restore();
        } else {
            // Calculate the width of the text
            const textBoxWidth = canvas.width / 2;
            const textLines = this.wrapText(ctx, text, textBoxWidth); // Call the wrapText function

            // Calculate the vertical spacing between lines (negative line height)
            const lineHeight = fontSize - 20;

            // Draw the text lines with a border in the calculated text box
            for (let i = 0; i < textLines.length; i++) {
                const line = textLines[i];
                // Calculate the vertical position of the current line
                const lineY = textY + i * lineHeight;

                // Introduce a random rotation angle (in radians)
                const rotation = (Math.random() - 0.5) * Math.PI / 20; // Adjust the angle as needed

                // Save the current canvas state
                ctx.save();

                // Translate to the position of the text and apply rotation
                ctx.translate(canvas.width / 2, lineY);
                ctx.rotate(rotation);

                // Draw the text at the calculated position with rotation
                ctx.strokeText(line, 0, 0); // Draw the text
                ctx.fillText(line, 0, 0);

                // Restore the canvas state to undo the rotation
                ctx.restore();
            }
        }

        return canvas;
    }

    private wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
        const words = text.split(" ");
        const lines = [];
        let currentLine = words[0];

        for (let i = 1; i < words.length; i++) {
            const word = words[i];
            const testLine = `${currentLine} ${word}`;
            const testWidth = ctx.measureText(testLine).width;

            if (testWidth <= maxWidth) {
                currentLine = testLine;
            } else {
                lines.push(currentLine);
                currentLine = word;
            }
        }

        lines.push(currentLine);
        return lines;
    }
}