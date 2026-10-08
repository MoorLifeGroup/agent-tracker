import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { ensureSchema, sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { extractPolicyDocument } from '@/lib/extract';

export const dynamic = 'force-dynamic';

const MAX_BYTES = 15 * 1024 * 1024; // 15 MB
const ALLOWED = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/heic',
  'image/heif',
]);

// POST /api/documents — multipart form: file (+ optional sale_id).
// Uploads to Vercel Blob, runs AI extraction, saves the document record.
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await ensureSchema();

  const form = await req.formData();
  const file = form.get('file') as File | null;
  const saleId = form.get('sale_id') ? Number(form.get('sale_id')) : null;

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'File too large (max 15 MB)' }, { status: 400 });
  }
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json({ error: 'Only PDF and image files (PNG/JPG/WebP/HEIC)' }, { status: 400 });
  }

  // Verify the sale belongs to this agent (or admin)
  if (saleId) {
    const { rows } = await sql`SELECT id FROM sales WHERE id = ${saleId}`;
    if (!rows.length) return NextResponse.json({ error: 'Sale not found' }, { status: 404 });
    if (session.role !== 'admin') {
      const { rows: own } = await sql`SELECT id FROM sales WHERE id = ${saleId} AND agent_id = ${session.userId}`;
      if (!own.length) return NextResponse.json({ error: 'Not your sale' }, { status: 403 });
    }
  }

  const blob = await put(`docs/${session.userId}/${Date.now()}-${file.name}`, file, {
    access: 'private',
    contentType: file.type,
  });

  // Run AI extraction on the document
  const buf = Buffer.from(await file.arrayBuffer());
  const extracted = await extractPolicyDocument(buf.toString('base64'), file.type);

  const { rows } = await sql`
    INSERT INTO documents (agent_id, sale_id, filename, blob_url, content_type, size_bytes, extracted)
    VALUES (${session.userId}, ${saleId}, ${file.name}, ${blob.url}, ${file.type}, ${file.size}, ${extracted ? JSON.stringify(extracted) : null})
    RETURNING id, filename, blob_url, content_type, extracted, created_at
  `;

  return NextResponse.json({ ok: true, document: rows[0] });
}

// GET /api/documents?sale_id= — list documents (own, or all for admin)
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await ensureSchema();

  const saleId = req.nextUrl.searchParams.get('sale_id');
  let rows;
  if (saleId) {
    ({ rows } = session.role === 'admin'
      ? await sql`SELECT d.*, u.display_name AS agent_name FROM documents d JOIN users u ON u.id = d.agent_id WHERE d.sale_id = ${Number(saleId)} ORDER BY d.created_at DESC`
      : await sql`SELECT d.*, u.display_name AS agent_name FROM documents d JOIN users u ON u.id = d.agent_id WHERE d.sale_id = ${Number(saleId)} AND d.agent_id = ${session.userId} ORDER BY d.created_at DESC`);
  } else {
    ({ rows } = session.role === 'admin'
      ? await sql`SELECT d.*, u.display_name AS agent_name FROM documents d JOIN users u ON u.id = d.agent_id ORDER BY d.created_at DESC LIMIT 100`
      : await sql`SELECT d.*, u.display_name AS agent_name FROM documents d JOIN users u ON u.id = d.agent_id WHERE d.agent_id = ${session.userId} ORDER BY d.created_at DESC LIMIT 100`);
  }
  return NextResponse.json({ documents: rows });
}

// DELETE /api/documents?id= — delete a document record (and its blob)
export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await ensureSchema();

  const id = Number(req.nextUrl.searchParams.get('id'));
  const { rows } = await sql`SELECT id, agent_id, blob_url FROM documents WHERE id = ${id}`;
  const doc = rows[0];
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (session.role !== 'admin' && doc.agent_id !== session.userId) {
    return NextResponse.json({ error: 'Not your document' }, { status: 403 });
  }

  try {
    const { del } = await import('@vercel/blob');
    await del(doc.blob_url);
  } catch {
    // blob already gone — still remove the record
  }
  await sql`DELETE FROM documents WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}
