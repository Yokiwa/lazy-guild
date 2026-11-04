CREATE TABLE devices (
  id TEXT PRIMARY KEY,
  secret_hash TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  tz TEXT NOT NULL,
  lang TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE slot_times (
  device_id TEXT NOT NULL,
  slot_id TEXT NOT NULL,
  weekday INTEGER NOT NULL,
  hhmm TEXT NOT NULL,
  PRIMARY KEY (device_id, slot_id, weekday)
);
CREATE TABLE one_offs (
  device_id TEXT NOT NULL,
  id TEXT NOT NULL,
  at TEXT NOT NULL,
  kind TEXT NOT NULL,
  run_id TEXT NOT NULL,
  PRIMARY KEY (device_id, id)
);
CREATE TABLE sent_log (
  device_id TEXT NOT NULL,
  key TEXT NOT NULL,
  sent_at TEXT NOT NULL,
  PRIMARY KEY (device_id, key)
);
CREATE INDEX one_offs_at ON one_offs(at);
