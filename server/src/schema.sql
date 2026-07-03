-- KR NIGHT database schema (PostgreSQL)

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  nickname TEXT NOT NULL,
  handle TEXT UNIQUE NOT NULL,            -- user ID for search e.g. @mike_seoul
  role TEXT NOT NULL DEFAULT 'user',      -- user | owner | admin
  language TEXT NOT NULL DEFAULT 'ko',    -- ko | en | ja | zh
  avatar_emoji TEXT NOT NULL DEFAULT '🌙',
  location_sharing BOOLEAN NOT NULL DEFAULT FALSE,
  points INTEGER NOT NULL DEFAULT 0,
  is_banned BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS venues (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  name_en TEXT,
  area TEXT NOT NULL,                     -- itaewon | hongdae | apgujeong | gangnam | seongsu | euljiro
  category TEXT NOT NULL,                 -- club | bar | lounge | pocha
  description_ko TEXT, description_en TEXT, description_ja TEXT, description_zh TEXT,
  lat DOUBLE PRECISION, lng DOUBLE PRECISION,
  address TEXT,
  instagram TEXT,
  genres TEXT NOT NULL DEFAULT '',        -- comma separated: hiphop,house,kpop,live,latin,techno
  foreigner_friendly BOOLEAN NOT NULL DEFAULT TRUE,
  entry_difficulty TEXT NOT NULL DEFAULT 'easy',   -- easy | normal | strict
  price_range TEXT NOT NULL DEFAULT '₩₩',
  dress_code TEXT DEFAULT 'Casual',
  entry_rules_ko TEXT, entry_rules_en TEXT, entry_rules_ja TEXT, entry_rules_zh TEXT,
  open_hours TEXT DEFAULT '20:00 - 05:00',
  cover_color TEXT DEFAULT '#7C3AED',
  cover_emoji TEXT DEFAULT '🎶',
  owner_user_id INTEGER REFERENCES users(id),
  plan TEXT NOT NULL DEFAULT 'free',      -- free | growth | pro
  subscription_status TEXT NOT NULL DEFAULT 'none', -- none | active | past_due | canceled
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS events (
  id SERIAL PRIMARY KEY,
  venue_id INTEGER NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  event_date DATE NOT NULL,
  lineup TEXT,
  price TEXT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS checkins (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  venue_id INTEGER NOT NULL REFERENCES venues(id),
  scanned_by INTEGER REFERENCES users(id),
  points_awarded INTEGER NOT NULL DEFAULT 0,
  checked_in_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,        -- lounge/location expiry (6h)
  checked_out_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_checkins_user ON checkins(user_id, checked_in_at DESC);
CREATE INDEX IF NOT EXISTS idx_checkins_venue ON checkins(venue_id, checked_in_at DESC);

CREATE TABLE IF NOT EXISTS points_ledger (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  delta INTEGER NOT NULL,
  reason TEXT NOT NULL,                   -- checkin_first | checkin | offpeak_bonus | invite | coupon_redeem | review
  ref_type TEXT, ref_id INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS coupons (
  id SERIAL PRIMARY KEY,
  venue_id INTEGER NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  points_cost INTEGER NOT NULL DEFAULT 0, -- 0 = welcome benefit
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS coupon_redemptions (
  id SERIAL PRIMARY KEY,
  coupon_id INTEGER NOT NULL REFERENCES coupons(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  code TEXT NOT NULL,
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  used_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS friendships (
  id SERIAL PRIMARY KEY,
  requester_id INTEGER NOT NULL REFERENCES users(id),
  addressee_id INTEGER NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'pending', -- pending | accepted | blocked
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(requester_id, addressee_id)
);

CREATE TABLE IF NOT EXISTS dm_messages (
  id SERIAL PRIMARY KEY,
  from_user INTEGER NOT NULL REFERENCES users(id),
  to_user INTEGER NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dm_pair ON dm_messages(from_user, to_user, created_at DESC);

CREATE TABLE IF NOT EXISTS lounge_messages (
  id SERIAL PRIMARY KEY,
  venue_id INTEGER NOT NULL REFERENCES venues(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_lounge_venue ON lounge_messages(venue_id, created_at DESC);

CREATE TABLE IF NOT EXISTS venue_saves (
  user_id INTEGER NOT NULL REFERENCES users(id),
  venue_id INTEGER NOT NULL REFERENCES venues(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, venue_id)
);

CREATE TABLE IF NOT EXISTS night_routes (
  id SERIAL PRIMARY KEY,
  area TEXT NOT NULL,
  title_ko TEXT, title_en TEXT, title_ja TEXT, title_zh TEXT,
  stops TEXT NOT NULL,                    -- JSON: [{time, venue_id, note_ko, note_en, note_ja, note_zh}]
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id SERIAL PRIMARY KEY,
  venue_id INTEGER NOT NULL REFERENCES venues(id),
  plan TEXT NOT NULL,                     -- growth | pro
  price INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',  -- active | past_due | canceled
  customer_key TEXT NOT NULL,
  billing_key TEXT,
  card_summary TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  next_billing_at TIMESTAMPTZ NOT NULL,
  canceled_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  subscription_id INTEGER NOT NULL REFERENCES subscriptions(id),
  amount INTEGER NOT NULL,
  status TEXT NOT NULL,                   -- paid | failed | simulated
  toss_payment_key TEXT,
  order_id TEXT NOT NULL,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reports (
  id SERIAL PRIMARY KEY,
  reporter_id INTEGER NOT NULL REFERENCES users(id),
  target_type TEXT NOT NULL,              -- user | lounge_message | dm_message | venue
  target_id INTEGER NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',    -- open | resolved
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
