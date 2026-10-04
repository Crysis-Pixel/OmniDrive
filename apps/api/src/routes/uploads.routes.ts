import { FastifyInstance } from 'fastify';
import { requireAuth } from '../middleware/auth.middleware';
import { uploadService } from '../services/upload.service';
import { initUploadSchema } from '@omnidrive/shared';

export async function uploadsRoutes(fastify: FastifyInstance) {
  // POST /api/uploads - Initiate resumable upload session
  fastify.post('/', { preHandler: [requireAuth] }, async (req, reply) => {
    const parseResult = initUploadSchema.safeParse(req.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: parseResult.error.errors[0].message,
        },
      });
    }

    try {
      const result = await uploadService.initUpload({
        userId: req.user!.id,
        parent: parseResult.data.parent,
        fileName: parseResult.data.fileName,
        size: parseResult.data.size,
        mimeType: parseResult.data.mimeType,
        strategy: parseResult.data.strategy,
        accountId: parseResult.data.accountId,
      });

      return result;
    } catch (err: any) {
      return reply.status(400).send({
        error: {
          code: 'UPLOAD_INIT_FAILED',
          message: err.message || 'Failed to initialize upload session',
        },
      });
    }
  });

  // PUT /api/uploads/:uploadId - Send chunk with Content-Range
  fastify.put('/:uploadId', { preHandler: [requireAuth] }, async (req, reply) => {
    const { uploadId } = req.params as { uploadId: string };
    const contentRange = req.headers['content-range'] as string;

    if (!contentRange) {
      return reply.status(400).send({
        error: { code: 'MISSING_RANGE', message: 'Content-Range header is required for chunk upload' },
      });
    }

    // req.body should be Buffer
    const bodyBuffer = req.body as Buffer;
    const chunk = Buffer.isBuffer(bodyBuffer) ? bodyBuffer : Buffer.from(String(bodyBuffer || ''));

    try {
      const result = await uploadService.uploadChunk({
        uploadId,
        userId: req.user!.id,
        chunk,
        contentRange,
      });

      if (result.isDone) {
        return reply.status(200).send({
          done: true,
          node: result.node,
        });
      } else {
        return reply.status(308).send({
          done: false,
          bytesReceived: result.bytesReceived,
        });
      }
    } catch (err: any) {
      return reply.status(500).send({
        error: {
          code: 'CHUNK_UPLOAD_FAILED',
          message: err.message || 'Chunk upload failed',
        },
      });
    }
  });

  // GET /api/uploads/:uploadId - Get upload session status / resume offset
  fastify.get('/:uploadId', { preHandler: [requireAuth] }, async (req, reply) => {
    const { uploadId } = req.params as { uploadId: string };

    try {
      const status = await uploadService.getUploadStatus(uploadId, req.user!.id);
      return status;
    } catch (err: any) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: err.message },
      });
    }
  });
}
