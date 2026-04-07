const Minio = require('minio');

const minioClient = new Minio.Client({
  endPoint:  process.env.MINIO_ENDPOINT  || 'minio',
  port:      parseInt(process.env.MINIO_PORT || '9000'),
  useSSL:    process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY || 'minio_admin',
  secretKey: process.env.MINIO_SECRET_KEY || 'minio_password',
});

const BUCKET = process.env.MINIO_BUCKET || 'quiz-images';

/**
 * Verify the bucket exists on startup.
 * The minio-init Docker container creates it, but this gives
 * a clear error if something went wrong.
 */
async function verifyBucket() {
  const exists = await minioClient.bucketExists(BUCKET);
  if (!exists) {
    throw new Error(`MinIO bucket "${BUCKET}" does not exist. Check minio-init container logs.`);
  }
  console.log(`MinIO connected — bucket "${BUCKET}" ready`);
}

verifyBucket().catch((err) => {
  console.error('MinIO connection failed:', err.message);
  // Don't crash the process — uploads will fail but the rest of the app is usable
});

module.exports = { minioClient, BUCKET };