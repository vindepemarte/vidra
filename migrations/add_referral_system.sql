-- Add referral system tables and columns
-- Migration: add_referral_system
-- Date: 2026-03-06

-- Add referral columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code VARCHAR(16) UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES users(id);

CREATE INDEX IF NOT EXISTS ix_users_referral_code ON users(referral_code);

-- Create referrals table
CREATE TABLE IF NOT EXISTS referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referrer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    referred_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    referrer_rewarded BOOLEAN DEFAULT FALSE,
    referred_rewarded BOOLEAN DEFAULT FALSE,
    referrer_credits INTEGER DEFAULT 100,
    referred_credits INTEGER DEFAULT 50,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(referrer_id, referred_user_id)
);

CREATE INDEX IF NOT EXISTS ix_referrals_referrer ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS ix_referrals_referred ON referrals(referred_user_id);

-- Generate referral codes for existing users who don't have one
-- Using a PL/pgSQL block to generate random codes
DO $$
DECLARE
    user_record RECORD;
    new_code TEXT;
    code_exists BOOLEAN;
BEGIN
    FOR user_record IN SELECT id FROM users WHERE referral_code IS NULL LOOP
        LOOP
            -- Generate 8-character alphanumeric code
            new_code := upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 8));
            
            -- Check if code already exists
            SELECT EXISTS(SELECT 1 FROM users WHERE referral_code = new_code) INTO code_exists;
            
            -- If unique, assign and exit loop
            IF NOT code_exists THEN
                UPDATE users SET referral_code = new_code WHERE id = user_record.id;
                EXIT;
            END IF;
        END LOOP;
    END LOOP;
END $$;
