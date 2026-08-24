import { ensureSchema, getD1 } from "../../../db";
import { defaultExcludedTerms, normalizeExcludedTerms } from "../../../lib/exclusions";

const settingsKey = "excluded_terms";

async function readTerms() {
  await ensureSchema();
  const row = await getD1().prepare("SELECT value FROM global_settings WHERE key = ?").bind(settingsKey).first<{ value: string }>();
  if (!row) {
    const terms = normalizeExcludedTerms(defaultExcludedTerms);
    await getD1().prepare("INSERT INTO global_settings (key, value, updated_at) VALUES (?, ?, ?)").bind(settingsKey, JSON.stringify(terms), new Date().toISOString()).run();
    return terms;
  }
  try {
    return normalizeExcludedTerms(JSON.parse(row.value));
  } catch {
    return normalizeExcludedTerms(defaultExcludedTerms);
  }
}

export async function GET() {
  try {
    return Response.json({ terms: await readTerms() });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "제외어를 불러오지 못했습니다." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const payload = await request.json() as { terms?: unknown };
    const terms = normalizeExcludedTerms(payload.terms);
    await ensureSchema();
    const db = getD1();
    await db.prepare(`INSERT INTO global_settings (key, value, updated_at) VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`)
      .bind(settingsKey, JSON.stringify(terms), new Date().toISOString()).run();
    return Response.json({ terms });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "제외어를 저장하지 못했습니다." }, { status: 500 });
  }
}
