-- This file contains the SQL commands to set up the database schema for the CashPay application.

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    uid VARCHAR(255) UNIQUE,
    role VARCHAR(50) NOT NULL DEFAULT 'Client', -- Client, Agent, Admin, Seller, Manager, PartnerB2B, Publisher, Guarantor
    status VARCHAR(50) NOT NULL DEFAULT 'Pending', -- Active, Inactive, Suspended, Pending
    account_type VARCHAR(50) DEFAULT 'national', -- national, diaspora, business
    id_wawwwwwwwwwllet VARCHAR(255) UNIQUE,
    language VARCHAR(10) DEFAULT 'fr',
    full_name VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    middle_name VARCHAR(100),
    gender VARCHAR(10),
    marital_status VARCHAR(20),
    birth_date DATE,
    birth_place VARCHAR(255),
    nationality VARCHAR(100),
    email VARCHAR(255) UNIQUE,
    phone VARCHAR(50) UNIQUE,
    country VARCHAR(100),
    province VARCHAR(100),
    city VARCHAR(100),
    address TEXT,
    profession VARCHAR(255),
    activity_description TEXT,
    income_per_month NUMERIC(15, 2),
    profile_photo VARCHAR(255),
    cover_photo VARCHAR(255),
    signature_image VARCHAR(255),
    pin_hash VARCHAR(255),
    password_hash VARCHAR(255),
    google_id VARCHAR(255) UNIQUE,
    zoom_id VARCHAR(255) UNIQUE,
    zoom_refresh_token TEXT,
    totp_secret VARCHAR(255),
    notifications_channel JSONB,
    assistantSettings JSONB,
    availabilityStatus VARCHAR(20) DEFAULT 'offline',
    schedule JSONB,
    representative JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    verification_status VARCHAR(20),
    temp_photo_expires_at TIMESTAMPTZ,
    is_crypto_active BOOLEAN DEFAULT false,
    mlm_rank_id INTEGER,
    api_key VARCHAR(255) UNIQUE,
    api_secret VARCHAR(255),
    left_child_id INT,
    right_child_id INT
);

-- Wallets Table
CREATE TABLE IF NOT EXISTS wallets (
    id SERIAL PRIMARY KEY,
    user_id INT,
    group_id INT,
    id_wallet VARCHAR(255) UNIQUE NOT NULL,
    balances JSONB,
    commission_balance JSONB,
    is_group_wallet BOOLEAN DEFAULT false,
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE SET NULL
);

-- Transactions Table
CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    reference_code VARCHAR(50) UNIQUE NOT NULL,
    type_code VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL,
    amount NUMERIC(15, 4) NOT NULL,
    currency VARCHAR(10) NOT NULL,
    fee NUMERIC(10, 4) DEFAULT 0,
    description TEXT,
    sender_id INT,
    receiver_id INT,
    sender_wallet_id VARCHAR(255),
    receiver_wallet_id VARCHAR(255),
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE SET NULL
);

-- OTPs Table
CREATE TABLE IF NOT EXISTS otps (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    code VARCHAR(10) NOT NULL,
    type VARCHAR(50),
    channel VARCHAR(20),
    expires_at TIMESTAMPTZ,
    used BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Registration OTPs Table
CREATE TABLE IF NOT EXISTS registration_otps (
    id SERIAL PRIMARY KEY,
    destination VARCHAR(255) NOT NULL,
    code VARCHAR(10) NOT NULL,
    expires_at TIMESTAMPTZ,
    used BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User Sessions Table
CREATE TABLE IF NOT EXISTS user_sessions (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    login_time TIMESTAMPTZ DEFAULT NOW(),
    logout_time TIMESTAMPTZ,
    ip_address VARCHAR(50),
    user_agent TEXT,
    user_agent_details JSONB,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- User Documents Table
CREATE TABLE IF NOT EXISTS user_documents (
    id SERIAL PRIMARY KEY,
    user_id INT UNIQUE NOT NULL,
    id_type VARCHAR(50),
    id_number VARCHAR(100),
    id_issued_date DATE,
    id_expiry_date DATE,
    id_front_image VARCHAR(255),
    id_back_image VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- User Verifications Table
CREATE TABLE IF NOT EXISTS user_verifications (
    id SERIAL PRIMARY KEY,
    user_id INT UNIQUE NOT NULL,
    status VARCHAR(20) DEFAULT 'pending', -- blue, green, red
    notes TEXT,
    verified_by INT, -- admin user id
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (verified_by) REFERENCES users(id)
);

-- Cards Table
CREATE TABLE IF NOT EXISTS cards (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    card_provider_id VARCHAR(255) UNIQUE,
    inventory_id INT UNIQUE,
    card_type VARCHAR(20) NOT NULL, -- virtuelle, physique
    brand VARCHAR(20) NOT NULL, -- visa, mastercard
    currency VARCHAR(10) NOT NULL,
    number VARCHAR(255), -- This should be a token in production
    last4 VARCHAR(4),
    exp_month INT,
    exp_year INT,
    cvv_encrypted VARCHAR(255), -- Encrypted
    status VARCHAR(20) DEFAULT 'inactive', -- active, inactive, cancelled
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (inventory_id) REFERENCES card_inventory(id) ON DELETE SET NULL
);

-- B2B Partner-Issued Cards Table
CREATE TABLE IF NOT EXISTS b2b_issued_cards (
    id SERIAL PRIMARY KEY,
    b2b_partner_id INT NOT NULL,
    partner_client_ref VARCHAR(255), -- Partner's internal ID for their client
    card_provider_id VARCHAR(255) UNIQUE,
    card_type VARCHAR(20) NOT NULL,
    brand VARCHAR(20) NOT NULL,
    currency VARCHAR(10) NOT NULL,
    number VARCHAR(255), -- This should be a token
    last4 VARCHAR(4),
    exp_month INT,
    exp_year INT,
    cvv_encrypted VARCHAR(255), -- Encrypted
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (b2b_partner_id) REFERENCES b2b_partners(id) ON DELETE CASCADE
);


-- Saved User Cards (for deposits)
CREATE TABLE IF NOT EXISTS saved_user_cards (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    card_brand VARCHAR(50),
    card_holder_name VARCHAR(255),
    last4 VARCHAR(4),
    expiry_month VARCHAR(2),
    expiry_year VARCHAR(4),
    card_token VARCHAR(255) NOT NULL,
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, last4, expiry_month, expiry_year),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);


-- Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(50),
    link VARCHAR(255),
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Referrals Table
CREATE TABLE IF NOT EXISTS referrals (
    id SERIAL PRIMARY KEY,
    referrer_user_id INT NOT NULL,
    referred_user_id INT UNIQUE NOT NULL,
    status VARCHAR(50) DEFAULT 'Pending Deposit',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (referrer_user_id) REFERENCES users(id),
    FOREIGN KEY (referred_user_id) REFERENCES users(id)
);

-- User Points Table
CREATE TABLE IF NOT EXISTS user_points (
    user_id INT PRIMARY KEY,
    points INT DEFAULT 0,
    source_referral_id INT,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (source_referral_id) REFERENCES referrals(id) ON DELETE SET NULL
);

-- Group Transactions Table
CREATE TABLE IF NOT EXISTS group_transactions (
    id SERIAL PRIMARY KEY,
    group_id INT NOT NULL,
    user_id INT NOT NULL,
    type VARCHAR(50) NOT NULL, -- contribution, payout
    amount NUMERIC(15, 2) NOT NULL,
    currency VARCHAR(10) NOT NULL,
    description TEXT,
    destination VARCHAR(255), -- For payouts
    source_transaction_id INT, -- For contributions
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (source_transaction_id) REFERENCES transactions(id)
);
