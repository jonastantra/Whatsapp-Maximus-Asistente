import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { CATALOG_SEED_KEY, DEFAULT_CATALOG } from "./catalog-seed";

export type ConversationMode = "AI" | "HUMAN";
export type ExportCategory =
  | "unclassified"
  | "business"
  | "personal"
  | "excluded";
export type MessageRole = "user" | "assistant" | "human";
export type DeliveryStatus = "pending" | "sending" | "sent" | "failed";
export type ConnectionStatus =
  | "disconnected"
  | "qr"
  | "connecting"
  | "connected";

export interface Conversation {
  id: number;
  phone: string;
  name: string | null;
  mode: ConversationMode;
  context_enabled: 0 | 1;
  context_notes: string | null;
  alternate_jid: string | null;
  export_category: ExportCategory;
  last_message_at: number | null;
  created_at: number;
}

export interface ConversationListItem extends Conversation {
  last_message_preview: string | null;
}

export interface Message {
  id: number;
  conversation_id: number;
  role: MessageRole;
  content: string;
  created_at: number;
  delivery_status?: DeliveryStatus | null;
  delivery_error?: string | null;
}

export interface ExportMessage extends Message {
  conversation_phone: string;
  conversation_name: string | null;
  export_category: ExportCategory;
}

export interface ConnectionState {
  id: 1;
  status: ConnectionStatus;
  qr_string: string | null;
  phone: string | null;
  updated_at: number;
}

export interface OutboxItem {
  id: number;
  conversation_id: number;
  phone: string;
  content: string;
  message_id: number | null;
  status: DeliveryStatus;
  attempts: number;
  next_attempt_at: number;
  last_error: string | null;
  wa_message_id: string | null;
  sent_at: number | null;
  created_at: number;
}

export interface ActivePromotion {
  id: 1;
  content: string;
  enabled: 0 | 1;
  updated_at: number;
}

export interface BotSettings {
  id: 1;
  ai_paused: 0 | 1;
  custom_prompt: string | null;
  promo_seed_key: string | null;
  catalog_seed_key: string | null;
  updated_at: number;
}

export interface CatalogItem {
  id: number;
  name: string;
  aliases: string | null;
  price: string;
  notes: string | null;
  active: 0 | 1;
  sort_order: number;
  updated_at: number;
}

export type CampaignStatus = "draft" | "active" | "paused" | "done";
export type CampaignRecipientStatus = "pending" | "sent" | "failed" | "skipped";

export interface MarketingCampaign {
  id: number;
  name: string;
  message: string;
  image_path: string;
  image_mime: string;
  status: CampaignStatus;
  window_start_hour: number;
  window_end_hour: number;
  min_delay_seconds: number;
  max_delay_seconds: number;
  created_at: number;
  updated_at: number;
}

export interface CampaignRecipient {
  id: number;
  campaign_id: number;
  phone: string;
  name: string | null;
  personalized_message: string | null;
  status: CampaignRecipientStatus;
  next_send_at: number;
  sent_at: number | null;
  last_error: string | null;
  created_at: number;
}

export interface CampaignListItem extends MarketingCampaign {
  total_recipients: number;
  pending_recipients: number;
  sent_recipients: number;
  failed_recipients: number;
  skipped_recipients: number;
  last_error: string | null;
}

type ConnectionStatePatch = {
  status?: ConnectionStatus;
  qr_string?: string | null;
  phone?: string | null;
};

const dataDir = path.resolve(process.cwd(), "data");
fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, "messages.db");
const db = new Database(dbPath);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone TEXT UNIQUE NOT NULL,
  name TEXT,
  mode TEXT CHECK(mode IN ('AI','HUMAN')) NOT NULL DEFAULT 'AI',
  last_message_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id),
  role TEXT CHECK(role IN ('user','assistant','human')) NOT NULL,
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_messages_conv
  ON messages(conversation_id, created_at);

CREATE TABLE IF NOT EXISTS connection_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  status TEXT CHECK(status IN ('disconnected','qr','connecting','connected'))
    NOT NULL DEFAULT 'disconnected',
  qr_string TEXT,
  phone TEXT,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

INSERT OR IGNORE INTO connection_state (id, status) VALUES (1, 'disconnected');

CREATE TABLE IF NOT EXISTS outbox (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL,
  phone TEXT NOT NULL,
  content TEXT NOT NULL,
  sent INTEGER NOT NULL DEFAULT 0,
  message_id INTEGER,
  status TEXT CHECK(status IN ('pending','sending','sent','failed')) NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at INTEGER NOT NULL DEFAULT (unixepoch()),
  last_error TEXT,
  wa_message_id TEXT,
  sent_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_outbox_pending
  ON outbox(sent, created_at);

CREATE TABLE IF NOT EXISTS active_promotion (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  content TEXT NOT NULL DEFAULT '',
  enabled INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

INSERT OR IGNORE INTO active_promotion (id) VALUES (1);

CREATE TABLE IF NOT EXISTS bot_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  ai_paused INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

INSERT OR IGNORE INTO bot_settings (id) VALUES (1);

CREATE TABLE IF NOT EXISTS catalog_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  aliases TEXT,
  price TEXT NOT NULL,
  notes TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_catalog_items_active
  ON catalog_items(active, sort_order);

CREATE TABLE IF NOT EXISTS marketing_campaigns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  message TEXT NOT NULL,
  image_path TEXT NOT NULL,
  image_mime TEXT NOT NULL,
  status TEXT CHECK(status IN ('draft','active','paused','done')) NOT NULL DEFAULT 'active',
  window_start_hour INTEGER NOT NULL DEFAULT 10,
  window_end_hour INTEGER NOT NULL DEFAULT 18,
  min_delay_seconds INTEGER NOT NULL DEFAULT 300,
  max_delay_seconds INTEGER NOT NULL DEFAULT 900,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS campaign_recipients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id INTEGER NOT NULL REFERENCES marketing_campaigns(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  name TEXT,
  status TEXT CHECK(status IN ('pending','sent','failed','skipped')) NOT NULL DEFAULT 'pending',
  next_send_at INTEGER NOT NULL,
  sent_at INTEGER,
  last_error TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(campaign_id, phone)
);

CREATE INDEX IF NOT EXISTS idx_campaign_recipients_due
  ON campaign_recipients(status, next_send_at);
`);

function ensureColumn(table: string, column: string, ddl: string): void {
  const columns = db.pragma(`table_info(${table})`) as Array<{ name: string }>;
  if (!columns.some((item) => item.name === column)) {
    db.exec(ddl);
  }
}

ensureColumn(
  "bot_settings",
  "custom_prompt",
  "ALTER TABLE bot_settings ADD COLUMN custom_prompt TEXT",
);

ensureColumn(
  "bot_settings",
  "promo_seed_key",
  "ALTER TABLE bot_settings ADD COLUMN promo_seed_key TEXT",
);

ensureColumn(
  "bot_settings",
  "catalog_seed_key",
  "ALTER TABLE bot_settings ADD COLUMN catalog_seed_key TEXT",
);

ensureColumn(
  "conversations",
  "context_enabled",
  "ALTER TABLE conversations ADD COLUMN context_enabled INTEGER NOT NULL DEFAULT 0",
);

ensureColumn(
  "conversations",
  "context_notes",
  "ALTER TABLE conversations ADD COLUMN context_notes TEXT",
);

ensureColumn(
  "conversations",
  "alternate_jid",
  "ALTER TABLE conversations ADD COLUMN alternate_jid TEXT",
);

ensureColumn(
  "conversations",
  "export_category",
  "ALTER TABLE conversations ADD COLUMN export_category TEXT NOT NULL DEFAULT 'unclassified'",
);

ensureColumn(
  "campaign_recipients",
  "personalized_message",
  "ALTER TABLE campaign_recipients ADD COLUMN personalized_message TEXT",
);

ensureColumn(
  "outbox",
  "message_id",
  "ALTER TABLE outbox ADD COLUMN message_id INTEGER",
);

ensureColumn(
  "outbox",
  "status",
  "ALTER TABLE outbox ADD COLUMN status TEXT NOT NULL DEFAULT 'pending'",
);

ensureColumn(
  "outbox",
  "attempts",
  "ALTER TABLE outbox ADD COLUMN attempts INTEGER NOT NULL DEFAULT 0",
);

ensureColumn(
  "outbox",
  "next_attempt_at",
  "ALTER TABLE outbox ADD COLUMN next_attempt_at INTEGER NOT NULL DEFAULT 0",
);

ensureColumn(
  "outbox",
  "last_error",
  "ALTER TABLE outbox ADD COLUMN last_error TEXT",
);

ensureColumn(
  "outbox",
  "wa_message_id",
  "ALTER TABLE outbox ADD COLUMN wa_message_id TEXT",
);

ensureColumn(
  "outbox",
  "sent_at",
  "ALTER TABLE outbox ADD COLUMN sent_at INTEGER",
);

db.exec(`
  UPDATE outbox
  SET status = CASE WHEN sent = 1 THEN 'sent' ELSE 'pending' END,
      next_attempt_at = CASE
        WHEN next_attempt_at = 0 THEN created_at
        ELSE next_attempt_at
      END
  WHERE status IS NULL
     OR (status = 'pending' AND sent = 1)
     OR next_attempt_at = 0;

  CREATE INDEX IF NOT EXISTS idx_outbox_delivery
    ON outbox(status, next_attempt_at, created_at);
`);

const kirklandRematePromotion = `
Promocion especial de remate de stock Kirkland liquido 5%.
Poco stock disponible, ultimas piezas. Caducidad: septiembre 2026.
Vigencia: solo hasta el 16 de mayo.
Precios:
- 1 mes: $199 MXN.
- 2 meses: $399 MXN.
- 3 meses: $499 MXN.
- 6 meses: $950 MXN.
- 2 cajas: $1,500 MXN.
Usala cuando pregunten por Kirkland, minoxidil liquido, promociones o remate.
Responde con urgencia real: es remate y hay poco stock.
`.trim();

const currentPromoSeedKey = "kirkland-remate-sept-2026-may-16";
const settingsForSeed = db
  .prepare("SELECT promo_seed_key FROM bot_settings WHERE id = 1")
  .get() as { promo_seed_key: string | null };

if (settingsForSeed.promo_seed_key !== currentPromoSeedKey) {
  db.transaction(() => {
    db.prepare(
      `
      UPDATE active_promotion
      SET content = ?, enabled = 1, updated_at = unixepoch()
      WHERE id = 1
    `,
    ).run(kirklandRematePromotion);

    db.prepare(
      `
      UPDATE bot_settings
      SET promo_seed_key = ?, updated_at = unixepoch()
      WHERE id = 1
    `,
    ).run(currentPromoSeedKey);
  })();
}

const catalogSeedState = db
  .prepare("SELECT catalog_seed_key FROM bot_settings WHERE id = 1")
  .get() as { catalog_seed_key: string | null };

const catalogCount = db
  .prepare("SELECT COUNT(*) AS count FROM catalog_items")
  .get() as { count: number };

if (catalogSeedState.catalog_seed_key !== CATALOG_SEED_KEY && catalogCount.count === 0) {
  db.transaction(() => {
    const insertCatalogItem = db.prepare(`
      INSERT INTO catalog_items
        (name, aliases, price, notes, active, sort_order)
      VALUES
        (?, ?, ?, ?, ?, ?)
      ON CONFLICT(name) DO UPDATE SET
        aliases = excluded.aliases,
        price = excluded.price,
        notes = excluded.notes,
        active = excluded.active,
        sort_order = excluded.sort_order,
        updated_at = unixepoch()
    `);

    DEFAULT_CATALOG.forEach((item, index) => {
      insertCatalogItem.run(
        item.name,
        item.aliases ?? null,
        item.price,
        item.notes ?? null,
        item.active === false ? 0 : 1,
        index,
      );
    });

    db.prepare(
      `
      UPDATE bot_settings
      SET catalog_seed_key = ?, updated_at = unixepoch()
      WHERE id = 1
    `,
    ).run(CATALOG_SEED_KEY);
  })();
}

const selectConversationByPhone = db.prepare(
  "SELECT * FROM conversations WHERE phone = ?",
);

const selectConversationById = db.prepare(
  "SELECT * FROM conversations WHERE id = ?",
);

const insertConversationStmt = db.prepare(`
  INSERT INTO conversations (phone, name)
  VALUES (?, ?)
  ON CONFLICT(phone) DO UPDATE SET
    name = COALESCE(excluded.name, conversations.name)
`);

const insertMessageStmt = db.prepare(`
  INSERT INTO messages (conversation_id, role, content)
  VALUES (?, ?, ?)
`);

const touchConversationStmt = db.prepare(`
  UPDATE conversations
  SET last_message_at = unixepoch()
  WHERE id = ?
`);

const insertMessageTx = db.transaction(
  (conversationId: number, role: MessageRole, content: string) => {
    const result = insertMessageStmt.run(conversationId, role, content);
    touchConversationStmt.run(conversationId);
    return Number(result.lastInsertRowid);
  },
);

const deleteConversationTx = db.transaction((id: number) => {
  db.prepare("DELETE FROM messages WHERE conversation_id = ?").run(id);
  db.prepare("DELETE FROM outbox WHERE conversation_id = ? AND sent = 0").run(id);
  db.prepare("DELETE FROM conversations WHERE id = ?").run(id);
});

export function getOrCreateConversation(
  phone: string,
  name?: string | null,
  alternateJid?: string | null,
): Conversation {
  const existing = db
    .prepare(
      `
      SELECT *
      FROM conversations
      WHERE phone IN (?, ?)
         OR alternate_jid IN (?, ?)
      ORDER BY CASE WHEN phone = ? THEN 0 ELSE 1 END, id ASC
      LIMIT 1
    `,
    )
    .get(
      phone,
      alternateJid ?? phone,
      phone,
      alternateJid ?? phone,
      phone,
    ) as Conversation | undefined;

  if (existing) {
    const otherJid =
      existing.phone === phone ? alternateJid : phone;
    db.prepare(
      `
      UPDATE conversations
      SET name = COALESCE(?, name),
          alternate_jid = COALESCE(?, alternate_jid)
      WHERE id = ?
    `,
    ).run(name ?? null, otherJid ?? null, existing.id);
    return getConversationById(existing.id) as Conversation;
  }

  insertConversationStmt.run(phone, name ?? null);
  if (alternateJid && alternateJid !== phone) {
    db.prepare(
      "UPDATE conversations SET alternate_jid = ? WHERE phone = ?",
    ).run(alternateJid, phone);
  }
  return selectConversationByPhone.get(phone) as Conversation;
}

export function getConversationByAddress(jid: string): Conversation | null {
  return (
    (db
      .prepare(
        `
        SELECT *
        FROM conversations
        WHERE phone = ? OR alternate_jid = ?
        ORDER BY id ASC
        LIMIT 1
      `,
      )
      .get(jid, jid) as Conversation | undefined) ?? null
  );
}

export function getConversationById(id: number): Conversation | null {
  return (selectConversationById.get(id) as Conversation | undefined) ?? null;
}

export function insertMessage(
  conversationId: number,
  role: MessageRole,
  content: string,
): number {
  return insertMessageTx(conversationId, role, content);
}

export function hasRecentMessageWithContent(
  conversationId: number,
  roles: MessageRole[],
  content: string,
  seconds = 180,
): boolean {
  if (roles.length === 0) return false;

  const rolePlaceholders = roles.map(() => "?").join(", ");
  const row = db
    .prepare(
      `
      SELECT id
      FROM messages
      WHERE conversation_id = ?
        AND role IN (${rolePlaceholders})
        AND content = ?
        AND created_at >= unixepoch() - ?
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    `,
    )
    .get(conversationId, ...roles, content, seconds) as
    | { id: number }
    | undefined;

  return !!row;
}

export function getMessages(conversationId: number, limit = 50): Message[] {
  const rows = db
    .prepare(
      `
      SELECT
        m.*,
        o.status AS delivery_status,
        o.last_error AS delivery_error
      FROM messages m
      LEFT JOIN outbox o ON o.message_id = m.id
      WHERE m.conversation_id = ?
      ORDER BY m.created_at DESC, m.id DESC
      LIMIT ?
    `,
    )
    .all(conversationId, limit) as Message[];

  return rows.reverse();
}

export function getRecentHistory(conversationId: number, limit = 20): Message[] {
  const rows = db
    .prepare(
      `
      SELECT *
      FROM messages
      WHERE conversation_id = ?
      ORDER BY created_at DESC, id DESC
      LIMIT ?
    `,
    )
    .all(conversationId, limit) as Message[];

  return rows.reverse();
}

export function setMode(
  conversationId: number,
  mode: ConversationMode,
): Conversation | null {
  db.prepare("UPDATE conversations SET mode = ? WHERE id = ?").run(
    mode,
    conversationId,
  );
  return getConversationById(conversationId);
}

export function setConversationContext(
  conversationId: number,
  enabled: boolean,
  notes: string,
): Conversation | null {
  db.prepare(
    `
    UPDATE conversations
    SET context_enabled = ?, context_notes = ?
    WHERE id = ?
  `,
  ).run(enabled ? 1 : 0, notes.trim() || null, conversationId);

  return getConversationById(conversationId);
}

export function setConversationExportCategory(
  conversationId: number,
  category: ExportCategory,
): Conversation | null {
  db.prepare(
    "UPDATE conversations SET export_category = ? WHERE id = ?",
  ).run(category, conversationId);
  return getConversationById(conversationId);
}

export function listConversations(): ConversationListItem[] {
  return db
    .prepare(
      `
      SELECT
        c.*,
        (
          SELECT m.content
          FROM messages m
          WHERE m.conversation_id = c.id
          ORDER BY m.created_at DESC, m.id DESC
          LIMIT 1
        ) AS last_message_preview
      FROM conversations c
      ORDER BY COALESCE(c.last_message_at, c.created_at) DESC, c.id DESC
    `,
    )
    .all() as ConversationListItem[];
}

export function listConversationsByIds(ids: number[]): Conversation[] {
  if (ids.length === 0) return [];
  const placeholders = ids.map(() => "?").join(", ");
  return db
    .prepare(
      `
      SELECT *
      FROM conversations
      WHERE id IN (${placeholders})
      ORDER BY COALESCE(last_message_at, created_at) DESC, id DESC
    `,
    )
    .all(...ids) as Conversation[];
}

export function getMessagesForExport(
  conversationIds: number[],
  options: { from?: number | null; to?: number | null } = {},
): ExportMessage[] {
  if (conversationIds.length === 0) return [];
  const placeholders = conversationIds.map(() => "?").join(", ");
  const clauses = [`m.conversation_id IN (${placeholders})`];
  const params: Array<number> = [...conversationIds];

  if (options.from) {
    clauses.push("m.created_at >= ?");
    params.push(options.from);
  }
  if (options.to) {
    clauses.push("m.created_at <= ?");
    params.push(options.to);
  }

  return db
    .prepare(
      `
      SELECT
        m.*,
        c.phone AS conversation_phone,
        c.name AS conversation_name,
        c.export_category
      FROM messages m
      JOIN conversations c ON c.id = m.conversation_id
      WHERE ${clauses.join(" AND ")}
      ORDER BY m.conversation_id ASC, m.created_at ASC, m.id ASC
    `,
    )
    .all(...params) as ExportMessage[];
}

export function getConnectionState(): ConnectionState {
  return db
    .prepare("SELECT * FROM connection_state WHERE id = 1")
    .get() as ConnectionState;
}

export function setConnectionState(patch: ConnectionStatePatch): ConnectionState {
  const assignments: string[] = [];
  const params: Record<string, string | null> = {};

  if ("status" in patch) {
    assignments.push("status = @status");
    params.status = patch.status ?? null;
  }

  if ("qr_string" in patch) {
    assignments.push("qr_string = @qr_string");
    params.qr_string = patch.qr_string ?? null;
  }

  if ("phone" in patch) {
    assignments.push("phone = @phone");
    params.phone = patch.phone ?? null;
  }

  assignments.push("updated_at = unixepoch()");

  db.prepare(
    `
    UPDATE connection_state
    SET ${assignments.join(", ")}
    WHERE id = 1
  `,
  ).run(params);

  return getConnectionState();
}

export function enqueueOutbox(
  conversationId: number,
  phone: string,
  content: string,
  messageId?: number | null,
): number {
  const result = db
    .prepare(
      `
      INSERT INTO outbox
        (conversation_id, phone, content, message_id, status, next_attempt_at)
      VALUES (?, ?, ?, ?, 'pending', unixepoch())
    `,
    )
    .run(conversationId, phone, content, messageId ?? null);

  return Number(result.lastInsertRowid);
}

export function getPendingOutbox(limit = 20): OutboxItem[] {
  db.prepare(
    `
    UPDATE outbox
    SET status = 'pending',
        last_error = COALESCE(last_error, 'Envío interrumpido por reinicio')
    WHERE status = 'sending'
      AND next_attempt_at <= unixepoch() - 120
  `,
  ).run();

  return db
    .prepare(
      `
      SELECT *
      FROM outbox
      WHERE status = 'pending'
        AND next_attempt_at <= unixepoch()
      ORDER BY created_at ASC, id ASC
      LIMIT ?
    `,
    )
    .all(limit) as OutboxItem[];
}

export function markOutboxSending(id: number): boolean {
  const result = db.prepare(
    `
    UPDATE outbox
    SET status = 'sending',
        attempts = attempts + 1,
        next_attempt_at = unixepoch()
    WHERE id = ? AND status = 'pending'
  `,
  ).run(id);
  return result.changes === 1;
}

export function markOutboxSent(id: number, waMessageId?: string | null): void {
  db.prepare(
    `
    UPDATE outbox
    SET sent = 1,
        status = 'sent',
        last_error = NULL,
        wa_message_id = ?,
        sent_at = unixepoch()
    WHERE id = ?
  `,
  ).run(waMessageId ?? null, id);
}

export function markOutboxFailed(
  id: number,
  error: string,
  options: { retry?: boolean; delaySeconds?: number } = {},
): void {
  db.prepare(
    `
    UPDATE outbox
    SET status = ?,
        last_error = ?,
        next_attempt_at = unixepoch() + ?
    WHERE id = ?
  `,
  ).run(
    options.retry ? "pending" : "failed",
    error.slice(0, 1000),
    options.delaySeconds ?? 0,
    id,
  );
}

export function retryOutboxForMessage(messageId: number): boolean {
  const result = db.prepare(
    `
    UPDATE outbox
    SET status = 'pending',
        attempts = 0,
        last_error = NULL,
        next_attempt_at = unixepoch()
    WHERE message_id = ? AND status = 'failed'
  `,
  ).run(messageId);
  return result.changes === 1;
}

export function getOutgoingMessageContentByWaId(
  waMessageId: string,
): string | null {
  const row = db.prepare(
    "SELECT content FROM outbox WHERE wa_message_id = ? LIMIT 1",
  ).get(waMessageId) as { content: string } | undefined;
  return row?.content ?? null;
}

export function deleteConversation(id: number): void {
  deleteConversationTx(id);
}

export function getActivePromotion(): ActivePromotion {
  return db
    .prepare("SELECT * FROM active_promotion WHERE id = 1")
    .get() as ActivePromotion;
}

export function setActivePromotion(
  content: string,
  enabled: boolean,
): ActivePromotion {
  db.prepare(
    `
    UPDATE active_promotion
    SET content = ?, enabled = ?, updated_at = unixepoch()
    WHERE id = 1
  `,
  ).run(content.trim(), enabled ? 1 : 0);

  return getActivePromotion();
}

export function getBotSettings(): BotSettings {
  return db
    .prepare("SELECT * FROM bot_settings WHERE id = 1")
    .get() as BotSettings;
}

export function setAiPaused(paused: boolean): BotSettings {
  db.prepare(
    `
    UPDATE bot_settings
    SET ai_paused = ?, updated_at = unixepoch()
    WHERE id = 1
  `,
  ).run(paused ? 1 : 0);

  return getBotSettings();
}

export function setCustomPrompt(content: string): BotSettings {
  db.prepare(
    `
    UPDATE bot_settings
    SET custom_prompt = ?, updated_at = unixepoch()
    WHERE id = 1
  `,
  ).run(content.trim());

  return getBotSettings();
}

function normalizeSearchText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function tokenScore(query: string, item: CatalogItem): number {
  const haystack = normalizeSearchText(
    [item.name, item.aliases ?? "", item.notes ?? ""].join(" "),
  );
  const tokens = normalizeSearchText(query)
    .split(/[^a-z0-9%]+/i)
    .filter((token) => token.length >= 3);

  let score = 0;
  for (const token of tokens) {
    if (haystack.includes(token)) score += 2;
  }

  if (item.active === 1) score += 1;
  return score;
}

function wantsPrice(text: string): boolean {
  const normalized = normalizeSearchText(text);
  return [
    "precio",
    "precios",
    "cuanto",
    "cuesta",
    "costo",
    "vale",
    "promocion",
    "paquete",
    "kit",
    "$",
  ].some((word) => normalized.includes(word));
}

export function listCatalogItems(): CatalogItem[] {
  return db
    .prepare(
      `
      SELECT *
      FROM catalog_items
      ORDER BY sort_order ASC, name ASC
    `,
    )
    .all() as CatalogItem[];
}

export function replaceCatalogItems(
  items: Array<{
    name: string;
    price: string;
    aliases?: string | null;
    notes?: string | null;
    active?: boolean;
  }>,
): CatalogItem[] {
  db.transaction(() => {
    db.prepare("DELETE FROM catalog_items").run();
    const insert = db.prepare(`
      INSERT INTO catalog_items
        (name, aliases, price, notes, active, sort_order)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    items.forEach((item, index) => {
      insert.run(
        item.name.trim(),
        item.aliases?.trim() || null,
        item.price.trim(),
        item.notes?.trim() || null,
        item.active === false ? 0 : 1,
        index,
      );
    });
  })();

  return listCatalogItems();
}

export function searchRelevantCatalog(
  text: string,
  limit = 8,
): CatalogItem[] {
  const items = listCatalogItems();
  const scored = items
    .map((item) => ({ item, score: tokenScore(text, item) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.item.sort_order - b.item.sort_order);

  if (scored.length > 0) {
    return scored.slice(0, limit).map(({ item }) => item);
  }

  if (wantsPrice(text)) {
    return items.filter((item) => item.active === 1).slice(0, Math.min(limit, 5));
  }

  return [];
}

export function createMarketingCampaign(input: {
  name: string;
  message: string;
  imagePath: string;
  imageMime: string;
  windowStartHour: number;
  windowEndHour: number;
  minDelaySeconds: number;
  maxDelaySeconds: number;
  recipients: Array<{
    phone: string;
    name?: string | null;
    personalizedMessage?: string | null;
    nextSendAt: number;
  }>;
}): MarketingCampaign {
  const campaign = db.transaction(() => {
    const result = db
      .prepare(
        `
        INSERT INTO marketing_campaigns
          (name, message, image_path, image_mime, status, window_start_hour,
           window_end_hour, min_delay_seconds, max_delay_seconds)
        VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?)
      `,
      )
      .run(
        input.name.trim(),
        input.message.trim(),
        input.imagePath,
        input.imageMime,
        input.windowStartHour,
        input.windowEndHour,
        input.minDelaySeconds,
        input.maxDelaySeconds,
      );

    const campaignId = Number(result.lastInsertRowid);
    const insertRecipient = db.prepare(
      `
      INSERT OR IGNORE INTO campaign_recipients
        (campaign_id, phone, name, personalized_message, next_send_at)
      VALUES (?, ?, ?, ?, ?)
    `,
    );

    for (const recipient of input.recipients) {
      insertRecipient.run(
        campaignId,
        recipient.phone,
        recipient.name?.trim() || null,
        recipient.personalizedMessage?.trim() || null,
        recipient.nextSendAt,
      );
    }

    return db
      .prepare("SELECT * FROM marketing_campaigns WHERE id = ?")
      .get(campaignId) as MarketingCampaign;
  })();

  return campaign;
}

export function listMarketingCampaigns(): CampaignListItem[] {
  return db
    .prepare(
      `
      SELECT
        c.*,
        COUNT(r.id) AS total_recipients,
        SUM(CASE WHEN r.status = 'pending' THEN 1 ELSE 0 END) AS pending_recipients,
        SUM(CASE WHEN r.status = 'sent' THEN 1 ELSE 0 END) AS sent_recipients,
        SUM(CASE WHEN r.status = 'failed' THEN 1 ELSE 0 END) AS failed_recipients,
        SUM(CASE WHEN r.status = 'skipped' THEN 1 ELSE 0 END) AS skipped_recipients,
        (
          SELECT rr.last_error
          FROM campaign_recipients rr
          WHERE rr.campaign_id = c.id
            AND rr.last_error IS NOT NULL
          ORDER BY rr.id DESC
          LIMIT 1
        ) AS last_error
      FROM marketing_campaigns c
      LEFT JOIN campaign_recipients r ON r.campaign_id = c.id
      GROUP BY c.id
      ORDER BY c.created_at DESC, c.id DESC
    `,
    )
    .all() as CampaignListItem[];
}

export function setMarketingCampaignStatus(
  id: number,
  status: Extract<CampaignStatus, "active" | "paused">,
): MarketingCampaign | null {
  db.prepare(
    `
    UPDATE marketing_campaigns
    SET status = ?, updated_at = unixepoch()
    WHERE id = ?
      AND status IN ('active', 'paused')
  `,
  ).run(status, id);

  return (
    (db
      .prepare("SELECT * FROM marketing_campaigns WHERE id = ?")
      .get(id) as MarketingCampaign | undefined) ?? null
  );
}

export function skipPendingCampaignRecipients(campaignId: number): void {
  db.prepare(
    `
    UPDATE campaign_recipients
    SET status = 'skipped', last_error = 'Campana pausada/cerrada manualmente'
    WHERE campaign_id = ?
      AND status = 'pending'
  `,
  ).run(campaignId);
}

export function deleteMarketingCampaign(id: number): void {
  db.prepare("DELETE FROM marketing_campaigns WHERE id = ?").run(id);
}

export function requeueCampaignRecipients(
  campaignId: number,
  includeSent: boolean,
): void {
  const statusFilter = includeSent
    ? "status IN ('pending', 'failed', 'skipped', 'sent')"
    : "status IN ('pending', 'failed', 'skipped')";

  db.prepare(
    `
    UPDATE campaign_recipients
    SET status = 'pending',
      next_send_at = unixepoch(),
      sent_at = NULL,
      last_error = NULL
    WHERE campaign_id = ?
      AND ${statusFilter}
  `,
  ).run(campaignId);

  db.prepare(
    `
    UPDATE marketing_campaigns
    SET status = 'active', updated_at = unixepoch()
    WHERE id = ?
  `,
  ).run(campaignId);
}

export function getDueCampaignRecipients(limit = 1): Array<
  CampaignRecipient & {
    campaign_name: string;
    message: string;
    image_path: string;
    image_mime: string;
  }
> {
  return db
    .prepare(
      `
      SELECT
        r.*,
        c.name AS campaign_name,
        COALESCE(r.personalized_message, c.message) AS message,
        c.image_path,
        c.image_mime
      FROM campaign_recipients r
      JOIN marketing_campaigns c ON c.id = r.campaign_id
      WHERE r.status = 'pending'
        AND r.next_send_at <= unixepoch()
        AND c.status = 'active'
      ORDER BY r.next_send_at ASC, r.id ASC
      LIMIT ?
    `,
    )
    .all(limit) as Array<
    CampaignRecipient & {
      campaign_name: string;
      message: string;
      image_path: string;
      image_mime: string;
    }
  >;
}

export function markCampaignRecipientSent(id: number): void {
  db.prepare(
    `
    UPDATE campaign_recipients
    SET status = 'sent', sent_at = unixepoch(), last_error = NULL
    WHERE id = ?
  `,
  ).run(id);
}

export function markCampaignRecipientFailed(id: number, error: string): void {
  db.prepare(
    `
    UPDATE campaign_recipients
    SET status = 'failed', last_error = ?
    WHERE id = ?
  `,
  ).run(error.slice(0, 500), id);
}

export function finalizeCompletedCampaigns(): void {
  db.prepare(
    `
    UPDATE marketing_campaigns
    SET status = 'done', updated_at = unixepoch()
    WHERE status = 'active'
      AND NOT EXISTS (
        SELECT 1
        FROM campaign_recipients r
        WHERE r.campaign_id = marketing_campaigns.id
          AND r.status = 'pending'
      )
  `,
  ).run();
}
