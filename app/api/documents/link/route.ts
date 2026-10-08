import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema, sql } from '@/lib/db';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// POST /api/documents/link — { document_id, sale_id } → attaches a
// previously uploaded document (e.g. scanned before the sale was saved)
// to a sale.
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await ensureSchema();

  const { document_id, sale_id } = await req.json();
  const { rows } = await sql`SELECT agent_id FROM documents WHERE id = ${Number(document_id)}`;
  const doc = rows[0];
  if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  if (session.role !== 'admin' && doc.agent_id !== session.userId) {
    return NextResponse.json({ error: 'Not your document' }, { status: 403 });
  }

  const { rows: sale } = await sql`SELECT agent_id FROM sales WHERE id = ${Number(sale_id)}`;
  if (!sale.length) return NextResponse.json({ error: 'Sale not found' }, { status: 404 });
  if (session.role !== 'admin' && sale[0].agent_id !== session.userId) {
    return NextResponse.json({ error: 'Not your sale' }, { status: 403 });
  }

  await sql`UPDATE documents SET sale_id = ${Number(sale_id)} WHERE id = ${Number(document_id)}`;
  return NextResponse.json({ ok: true });
}
