import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { createServer } from '../src/server';

describe('OmniDrive API Integration Suite', () => {
  let app: FastifyInstance;
  let sessionCookie: string;
  let userEmail = `tester_${Date.now()}@test.com`;
  let accounts: any[] = [];
  let rootNodes: any[] = [];

  beforeAll(async () => {
    app = await createServer();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('1. GET /health should return healthy and OmniDrive app info', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/health',
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('healthy');
    expect(body.app).toBe('OmniDrive');
  });

  it('2. POST /api/auth/register should create a user and seed demo accounts', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: userEmail,
        password: 'Password123!',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.user.email).toBe(userEmail);
    expect(body.token).toBeDefined();

    // Store cookie for subsequent authenticated calls
    const setCookie = res.headers['set-cookie'] as string;
    expect(setCookie).toBeDefined();
    sessionCookie = setCookie.split(';')[0];
  });

  it('3. GET /api/auth/me should return the authenticated user', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { cookie: sessionCookie },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.user.email).toBe(userEmail);
  });

  it('4. GET /api/accounts should return the linked drive accounts', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/accounts',
      headers: { cookie: sessionCookie },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.accounts.length).toBeGreaterThanOrEqual(2);
    accounts = body.accounts;
    expect(accounts[0].email).toBeDefined();
    expect(accounts[0].quotaLimit).toBeDefined();
  });

  it('5. GET /api/storage/summary should return combined and per-account quota', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/storage/summary',
      headers: { cookie: sessionCookie },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.totalLimit).toBeGreaterThan(0);
    expect(body.accounts.length).toBeGreaterThanOrEqual(2);
  });

  it('6. GET /api/nodes should list accounts as top-level virtual folders at root', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/nodes',
      headers: { cookie: sessionCookie },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.isRoot).toBe(true);
    expect(body.items.length).toBeGreaterThanOrEqual(2);
    expect(body.items[0].isFolder).toBe(true);
    expect(body.items[0].id).toContain(':root');
    rootNodes = body.items;
  });

  it('7. GET /api/nodes?parent=<accountId>:root should browse files inside an account', async () => {
    const firstAccFolderId = rootNodes[0].id;
    const res = await app.inject({
      method: 'GET',
      url: `/api/nodes?parent=${encodeURIComponent(firstAccFolderId)}`,
      headers: { cookie: sessionCookie },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.isRoot).toBe(false);
    expect(body.breadcrumbs.length).toBe(2);
    expect(body.items.length).toBeGreaterThan(0);
  });

  it('8. POST /api/nodes/folders should create a new folder', async () => {
    const targetParent = rootNodes[0].id;
    const res = await app.inject({
      method: 'POST',
      url: '/api/nodes/folders',
      headers: { cookie: sessionCookie },
      payload: {
        parent: targetParent,
        name: 'Test New Folder',
      },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.folder.name).toBe('Test New Folder');
    expect(body.folder.isFolder).toBe(true);
  });

  it('9. Resumable Upload: POST /api/uploads and PUT /api/uploads/:id should upload a file chunk', async () => {
    const content = Buffer.from('Hello OmniDrive Chunked Upload Content!');
    const initRes = await app.inject({
      method: 'POST',
      url: '/api/uploads',
      headers: { cookie: sessionCookie },
      payload: {
        parent: rootNodes[0].id,
        fileName: 'test_upload.txt',
        size: content.length,
        mimeType: 'text/plain',
      },
    });

    expect(initRes.statusCode).toBe(200);
    const initBody = JSON.parse(initRes.body);
    expect(initBody.uploadId).toBeDefined();

    // Upload the chunk
    const chunkRes = await app.inject({
      method: 'PUT',
      url: `/api/uploads/${initBody.uploadId}`,
      headers: {
        cookie: sessionCookie,
        'content-range': `bytes 0-${content.length - 1}/${content.length}`,
      },
      payload: content,
    });

    expect(chunkRes.statusCode).toBe(200);
    const chunkBody = JSON.parse(chunkRes.body);
    expect(chunkBody.done).toBe(true);
    expect(chunkBody.node.name).toBe('test_upload.txt');
  });

  it('10. PUT /api/nodes/:nodeId/content should edit file and respect revision checks', async () => {
    // Find editable file in first account
    const listRes = await app.inject({
      method: 'GET',
      url: `/api/nodes?parent=${encodeURIComponent(rootNodes[0].id)}`,
      headers: { cookie: sessionCookie },
    });
    const items = JSON.parse(listRes.body).items;
    const editable = items.find((i: any) => !i.isFolder && i.name.endsWith('.md'));
    expect(editable).toBeDefined();

    // Edit content
    const newContent = Buffer.from('# Updated Markdown Header\n\nContent was edited via OmniDrive Monaco test!');
    const editRes = await app.inject({
      method: 'PUT',
      url: `/api/nodes/${encodeURIComponent(editable.id)}/content`,
      headers: {
        cookie: sessionCookie,
        'if-match': editable.headRevisionId || undefined,
      },
      payload: newContent,
    });

    expect(editRes.statusCode).toBe(200);
    const updated = JSON.parse(editRes.body).node;
    expect(updated.headRevisionId).not.toBe(editable.headRevisionId);

    // Test 409 Conflict with stale revision
    const conflictRes = await app.inject({
      method: 'PUT',
      url: `/api/nodes/${encodeURIComponent(editable.id)}/content`,
      headers: {
        cookie: sessionCookie,
        'if-match': 'stale_revision_id_999',
      },
      payload: Buffer.from('Conflicting text'),
    });
    expect(conflictRes.statusCode).toBe(409);
    const errBody = JSON.parse(conflictRes.body);
    expect(errBody.error.code).toBe('REVISION_CONFLICT');
  });

  it('11. POST /api/nodes/:nodeId/move cross-account should create a TransferJob', async () => {
    // Move from account 0 to account 1
    const listRes = await app.inject({
      method: 'GET',
      url: `/api/nodes?parent=${encodeURIComponent(rootNodes[0].id)}`,
      headers: { cookie: sessionCookie },
    });
    const items = JSON.parse(listRes.body).items;
    const fileToMove = items.find((i: any) => !i.isFolder);

    const moveRes = await app.inject({
      method: 'POST',
      url: `/api/nodes/${encodeURIComponent(fileToMove.id)}/move`,
      headers: { cookie: sessionCookie },
      payload: {
        destinationParent: rootNodes[1].id,
      },
    });

    expect(moveRes.statusCode).toBe(200);
    const moveBody = JSON.parse(moveRes.body);
    expect(moveBody.transferJob).toBeDefined();
    expect(moveBody.transferJob.type).toBe('move');
  });

  it('12. GET /api/search should return matching files across accounts', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/search?q=OmniDrive',
      headers: { cookie: sessionCookie },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.items.length).toBeGreaterThan(0);
    expect(body.items[0].name.toLowerCase()).toContain('omnidrive');
  });
});
