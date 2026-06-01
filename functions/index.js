import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export default async ({ req, res, log, error }) => {
    // 1. Parse the incoming data sent from your frontend
    // Appwrite functions receive body as a string or object depending on how it was sent
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const fileName = body.fileName;
    const fileType = body.fileType || "audio/mpeg";

    if (!fileName) {
        error("Missing fileName in request");
        return res.json({ error: "fileName is required" }, 400);
    }

    try {
        // 2. Initialize the Cloudflare R2 Connection
        // These process.env variables are securely hidden in your Appwrite Console
        const S3 = new S3Client({
            region: "auto",
            endpoint: `https://63da69305ac7a82a7e65fda9a21cb664.r2.cloudflarestorage.com`,
            credentials: {
                accessKeyId:'b789aed3a2292150b94b7b646c49d77b',
                secretAccessKey: '8c28635d148f74e59738358ba06d37d17b7706dc64011db99f4973cbaa9c7a2f',
            },
        });

        // 3. Create a unique, safe file path
        // Adds a timestamp so if you upload two songs named "track.mp3", they don't overwrite each other
        const safeFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
        const uniqueKey = `tracks/${Date.now()}-${safeFileName}`;

        // 4. Set up the upload command
        const command = new PutObjectCommand({
            Bucket: 'thinking',
            Key: uniqueKey,
            ContentType: fileType
        });

        // 5. Generate the 15-minute VIP Pass (900 seconds)
        const vipPassUrl = await getSignedUrl(S3, command, { expiresIn: 900 });

        log(`Successfully generated VIP pass for: ${uniqueKey}`);

        // 6. Send the VIP URL and the final File URL back to the frontend
        return res.json({ 
            uploadUrl: vipPassUrl,
            // We also return the final public URL so your frontend can instantly save it to the database
            finalFileUrl: `https://pub-1b4a853a5f0d498caff77b78b258549d.r2.dev` 
        });

    } catch (err) {
        error(`Failed to generate URL: ${err.message}`);
        return res.json({ error: "Internal Server Error" }, 500);
    }
};