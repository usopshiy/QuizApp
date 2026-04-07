const { v4: uuidv4 } = require('uuid');
const path = require('path');
const { minioClient, BUCKET } = require('../config/minio');

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_FILE_SIZE_MB = 5;

/**
 * Upload an image buffer to MinIO.
 * Returns the public URL of the stored object.
 *
 * @param {Buffer} buffer      - File content
 * @param {string} mimetype    - e.g. 'image/png'
 * @param {string} originalName - Original filename (used for extension only)
 * @returns {Promise<string>}  - Public URL
 */
async function uploadImage(buffer, mimetype, originalName) {
  if (!ALLOWED_MIME_TYPES.includes(mimetype)) {
    const err = new Error(`Unsupported file type: ${mimetype}`);
    err.statusCode = 400;
    throw err;
  }

  if (buffer.byteLength > MAX_FILE_SIZE_MB * 1024 * 1024) {
    const err = new Error(`File exceeds ${MAX_FILE_SIZE_MB}MB limit`);
    err.statusCode = 400;
    throw err;
  }

  const ext        = path.extname(originalName) || '.jpg';
  const objectName = `questions/${uuidv4()}${ext}`;

  await minioClient.putObject(BUCKET, objectName, buffer, buffer.byteLength, {
    'Content-Type': mimetype,
  });

  return buildPublicUrl(objectName);
}

/**
 * Delete an image from MinIO by its full URL or object name.
 * Silently succeeds if the object doesn't exist.
 */
async function deleteImage(urlOrObjectName) {
  const objectName = extractObjectName(urlOrObjectName);
  try {
    await minioClient.removeObject(BUCKET, objectName);
  } catch (err) {
    // NoSuchKey is fine — object was already gone
    if (err.code !== 'NoSuchKey') throw err;
  }
}

/**
 * Generate a presigned URL for direct browser upload (optional advanced use).
 * Expires in 10 minutes.
 */
async function presignedPutUrl(filename, mimetype) {
  const ext        = path.extname(filename) || '.jpg';
  const objectName = `questions/${uuidv4()}${ext}`;

  const url = await minioClient.presignedPutObject(BUCKET, objectName, 10 * 60);
  return { url, objectName, publicUrl: buildPublicUrl(objectName) };
}

// Helpers

function buildPublicUrl(objectName) {
  const endpoint = process.env.MINIO_ENDPOINT || 'minio';
  const port     = process.env.MINIO_PORT     || '9000';
  const ssl      = process.env.MINIO_USE_SSL === 'true';
  const protocol = ssl ? 'https' : 'http';

  return `${protocol}://${endpoint}:${port}/${BUCKET}/${objectName}`;
}

function extractObjectName(urlOrObjectName) {
  if (urlOrObjectName.startsWith('http')) {
    // Strip everything up to and including the bucket name
    const parts = urlOrObjectName.split(`/${BUCKET}/`);
    return parts[1] ?? urlOrObjectName;
  }
  return urlOrObjectName;
}

module.exports = { uploadImage, deleteImage, presignedPutUrl };