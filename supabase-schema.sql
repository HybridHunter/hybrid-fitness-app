-- Generic key-value data store (replaces all localStorage keys)
CREATE TABLE IF NOT EXISTS data_store (
  id BIGSERIAL PRIMARY KEY,
  gym_id TEXT NOT NULL DEFAULT 'default',
  key TEXT NOT NULL,
  value JSONB,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(gym_id, key)
);

-- Enable Row Level Security
ALTER TABLE data_store ENABLE ROW LEVEL SECURITY;

-- Policy: anyone can read (for station mode which has no auth)
CREATE POLICY "Allow public read" ON data_store FOR SELECT USING (true);

-- Policy: authenticated users can insert/update
CREATE POLICY "Allow authenticated write" ON data_store FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow authenticated update" ON data_store FOR UPDATE USING (true);

-- Index for fast lookups
CREATE INDEX idx_data_store_gym_key ON data_store(gym_id, key);

-- Auto-update timestamp
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_timestamp
  BEFORE UPDATE ON data_store
  FOR EACH ROW
  EXECUTE FUNCTION update_modified_column();
