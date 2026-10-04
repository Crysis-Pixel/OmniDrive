import { FastifyInstance } from 'fastify';
import { requireAuth } from '../middleware/auth.middleware';
import { db } from '../db';
import { transferService } from '../services/transfer.service';
import { TransferJobDTO } from '@omnidrive/shared';

export async function transfersRoutes(fastify: FastifyInstance) {
  // GET /api/transfers - List user's transfer jobs
  fastify.get('/', { preHandler: [requireAuth] }, async (req) => {
    const jobs = await db.transferJob.findMany({
      where: { userId: req.user!.id },
    });

    const dtos: TransferJobDTO[] = jobs.map((j: any) => {
      const total = j.bytesTotal ? Number(j.bytesTotal) : 0;
      const done = Number(j.bytesDone || 0);
      const percentDone = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : (j.status === 'done' ? 100 : 0);

      return {
        id: j.id,
        userId: j.userId,
        type: j.type,
        srcAccount: j.srcAccount,
        srcDriveId: j.srcDriveId,
        dstAccount: j.dstAccount,
        dstParentId: j.dstParentId,
        status: j.status,
        bytesTotal: j.bytesTotal ? j.bytesTotal.toString() : null,
        bytesDone: j.bytesDone ? j.bytesDone.toString() : '0',
        percentDone,
        error: j.error,
        createdAt: j.createdAt.toISOString(),
        updatedAt: j.updatedAt.toISOString(),
      };
    });

    return { transfers: dtos };
  });

  // GET /api/transfers/:id - Transfer job details
  fastify.get('/:id', { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const job = await db.transferJob.findUnique({ where: { id } });

    if (!job || job.userId !== req.user!.id) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Transfer job not found' },
      });
    }

    const total = job.bytesTotal ? Number(job.bytesTotal) : 0;
    const done = Number(job.bytesDone || 0);
    const percentDone = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : (job.status === 'done' ? 100 : 0);

    const dto: TransferJobDTO = {
      id: job.id,
      userId: job.userId,
      type: job.type,
      srcAccount: job.srcAccount,
      srcDriveId: job.srcDriveId,
      dstAccount: job.dstAccount,
      dstParentId: job.dstParentId,
      status: job.status,
      bytesTotal: job.bytesTotal ? job.bytesTotal.toString() : null,
      bytesDone: job.bytesDone ? job.bytesDone.toString() : '0',
      percentDone,
      error: job.error,
      createdAt: job.createdAt.toISOString(),
      updatedAt: job.updatedAt.toISOString(),
    };

    return { transfer: dto };
  });

  // DELETE /api/transfers/:id - Cancel transfer job
  fastify.delete('/:id', { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      await transferService.cancelTransfer(id, req.user!.id);
      return { success: true, message: 'Transfer job cancelled' };
    } catch (err: any) {
      return reply.status(400).send({
        error: { code: 'CANCEL_FAILED', message: err.message },
      });
    }
  });
}
