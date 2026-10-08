export const DORU_APPLICATION_ID = 0x444f5255;

export const SCHEMA_VERSION = 1;

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS person (
  id TEXT PRIMARY KEY,
  names TEXT NOT NULL DEFAULT '[]',
  sex TEXT CHECK (sex IN ('M', 'F', 'U') OR sex IS NULL),
  birth_json TEXT,
  death_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS family (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS family_parent (
  family_id TEXT NOT NULL REFERENCES family(id) ON DELETE CASCADE,
  parent_id TEXT NOT NULL REFERENCES person(id) ON DELETE CASCADE,
  PRIMARY KEY (family_id, parent_id)
);

CREATE TABLE IF NOT EXISTS family_child (
  family_id TEXT NOT NULL REFERENCES family(id) ON DELETE CASCADE,
  child_id TEXT NOT NULL REFERENCES person(id) ON DELETE CASCADE,
  PRIMARY KEY (family_id, child_id)
);

CREATE TABLE IF NOT EXISTS event (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  date_json TEXT,
  place_id TEXT,
  description TEXT,
  person_id TEXT REFERENCES person(id) ON DELETE CASCADE,
  family_id TEXT REFERENCES family(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS source (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  author TEXT,
  publication TEXT
);

CREATE TABLE IF NOT EXISTS citation (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES source(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  detail_json TEXT
);

CREATE TABLE IF NOT EXISTS place (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  lat REAL,
  lon REAL
);

CREATE TABLE IF NOT EXISTS media (
  id TEXT PRIMARY KEY,
  path TEXT NOT NULL,
  caption TEXT,
  target_type TEXT,
  target_id TEXT
);

CREATE TABLE IF NOT EXISTS note (
  id TEXT PRIMARY KEY,
  text TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_family_parent_parent ON family_parent(parent_id);
CREATE INDEX IF NOT EXISTS idx_family_child_child ON family_child(child_id);
CREATE INDEX IF NOT EXISTS idx_event_person ON event(person_id);

CREATE VIRTUAL TABLE IF NOT EXISTS person_fts USING fts5(names, content='person', content_rowid='rowid');

CREATE TRIGGER IF NOT EXISTS person_fts_insert AFTER INSERT ON person BEGIN
  INSERT INTO person_fts(rowid, names) VALUES (new.rowid, new.names);
END;

CREATE TRIGGER IF NOT EXISTS person_fts_delete AFTER DELETE ON person BEGIN
  INSERT INTO person_fts(person_fts, rowid, names) VALUES ('delete', old.rowid, old.names);
END;

CREATE TRIGGER IF NOT EXISTS person_fts_update AFTER UPDATE ON person BEGIN
  INSERT INTO person_fts(person_fts, rowid, names) VALUES ('delete', old.rowid, old.names);
  INSERT INTO person_fts(rowid, names) VALUES (new.rowid, new.names);
END;
`;
