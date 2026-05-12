import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

export type ConversationMode = "AI" | "HUMAN";
export type MessageRole = "user" | "assistant" | "human";
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
  sent: 0 | 1;
  created_at: number;
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
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_outbox_pending
  ON outbox(sent, created_at);
`);

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
): Conversation {
  insertConversationStmt.run(phone, name ?? null);
  return selectConversationByPhone.get(phone) as Conversation;
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

export function getMessages(conversationId: number, limit = 50): Message[] {
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
): number {
  const result = db
    .prepare(
      `
      INSERT INTO outbox (conversation_id, phone, content)
      VALUES (?, ?, ?)
    `,
    )
    .run(conversationId, phone, content);

  return Number(result.lastInsertRowid);
}

export function getPendingOutbox(limit = 20): OutboxItem[] {
  return db
    .prepare(
      `
      SELECT *
      FROM outbox
      WHERE sent = 0
      ORDER BY created_at ASC, id ASC
      LIMIT ?
    `,
    )
    .all(limit) as OutboxItem[];
}

export function markOutboxSent(id: number): void {
  db.prepare("UPDATE outbox SET sent = 1 WHERE id = ?").run(id);
}

export function deleteConversation(id: number): void {
  deleteConversationTx(id);
}
