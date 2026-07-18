CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    role VARCHAR(20) NOT NULL DEFAULT 'Client' CHECK (role IN ('Client', 'Agent', 'Admin', 'Seller', 'Manager', 'PartnerB2B', 'Publisher', 'Guarantor', 'SuperAgent', 'SubSuperAgent')),
    status VARCHAR(20) NOT NULL DEFAULT 'Pending' CHECK (status IN ('Active', 'Inactive', 'Suspended', 'Pending')),
    account_type VARCHAR(20) NOT NULL CHECK (account_type IN ('national', 'diaspora', 'business')),
    id_wallet VARCHAR(12) UNIQUE NOT NULL,
    language VARCHAR(5) DEFAULT 'fr',
    full_name VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    middle_name VARCHAR(100),
    gender VARCHAR(10) CHECK (gender IN ('male', 'female', 'other')),
    marital_status VARCHAR(20) CHECK (marital_status IN ('single', 'married', 'divorced', 'widowed')),
    birth_date DATE,
    birth_place VARCHAR(255),
    nationality VARCHAR(100),
    email VARCHAR(255) UNIQUE,
    phone VARCHAR(20) UNIQUE,
    country VARCHAR(100),
    province VARCHAR(100),
    city VARCHAR(100),
    address TEXT,
    profession VARCHAR(255),
    activity_description TEXT,
    income_per_month NUMERIC(15, 2),
    profile_photo TEXT,
    cover_photo TEXT,
    signature_image TEXT,
    pin_hash VARCHAR(255),
    password_hash VARCHAR(255),
    google_id VARCHAR(255) UNIQUE,
    zoom_id VARCHAR(255) UNIQUE,
    zoom_refresh_token TEXT,
    totp_secret VARCHAR(255),
    notifications_channel TEXT[],
    assistantSettings JSONB,
    availabilityStatus VARCHAR(20) DEFAULT 'offline' CHECK (availabilityStatus IN ('available', 'busy', 'away', 'offline')),
    schedule JSONB,
    representative JSONB,
    verification_status VARCHAR(20) CHECK (verification_status IN ('blue', 'green', 'red')),
    temp_photo_expires_at TIMESTAMPTZ,
    is_crypto_active BOOLEAN DEFAULT false,
    mlm_rank_id INT,
    api_key VARCHAR(255) UNIQUE,
    api_secret VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT b2b_must_be_business CHECK (role != 'PartnerB2B' OR account_type = 'business')
);



CREATE TABLE wallets (
    id SERIAL PRIMARY KEY,
    user_id INT UNIQUE,
    id_wallet VARCHAR(12) UNIQUE NOT NULL,
    balances JSONB,
    commission_balance JSONB,
    is_group_wallet BOOLEAN DEFAULT false,
    last_updated TIMESTAMPTZ,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE transactions (
    id SERIAL PRIMARY KEY,
    reference_code VARCHAR(50) UNIQUE NOT NULL,
    type_code VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('Completed', 'Pending', 'Failed', 'Reversed')),
    amount NUMERIC(15, 2) NOT NULL,
    currency VARCHAR(10) NOT NULL,
    fee NUMERIC(10, 2) DEFAULT 0.00,
    description VARCHAR(255),
    sender_id INT NOT NULL,
    receiver_id INT,
    sender_wallet_id VARCHAR(12) NOT NULL,
    receiver_wallet_id VARCHAR(12),
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE RESTRICT,
    FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE TABLE transaction_types (
    id SERIAL PRIMARY KEY,
    code VARCHAR(20) NOT NULL,
    description VARCHAR(255) NOT NULL,
    category VARCHAR(10) NOT NULL CHECK (category IN ('Debit', 'Credit', 'Internal'))
);

CREATE TABLE countries_list (
  id SERIAL PRIMARY KEY,
  code VARCHAR(2) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  continent VARCHAR(50),
  dial_code VARCHAR(10),
  currency_name VARCHAR(100),
  currency_code VARCHAR(3),
  currency_symbol VARCHAR(5),
  status status_enum NOT NULL DEFAULT 'Active'
);

CREATE TABLE chess_games (
    id SERIAL PRIMARY KEY,
    game_code VARCHAR(20) UNIQUE,
    player1_id INTEGER REFERENCES users(id),
    player2_id INTEGER REFERENCES users(id),
    player1_color VARCHAR(10),
    bet_amount DECIMAL(10, 2),
    currency VARCHAR(10),
    status VARCHAR(20) CHECK (status IN ('waiting', 'active', 'completed', 'abandoned')),
    fen TEXT, -- Forsyth-Edwards Notation
    winner_id INTEGER REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ
	 
);

CREATE TABLE IF NOT EXISTS publisher_sites (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    url VARCHAR(2048) NOT NULL UNIQUE,
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, approved, rejected
    verification_code VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Table pour les emplacements publicitaires sur les sites des éditeurs
CREATE TABLE IF NOT EXISTS ad_placements (
    id SERIAL PRIMARY KEY,
    blogger_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    site_id INTEGER REFERENCES publisher_sites(id) ON DELETE CASCADE,
    placement_code VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    format VARCHAR(50) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ad_logs (
    id BIGSERIAL PRIMARY KEY,
    placement_id INTEGER NOT NULL REFERENCES ad_placements(id) ON DELETE CASCADE,
    campaign_id INTEGER NOT NULL REFERENCES ad_campaigns(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL, -- 'view' or 'click'
    "timestamp" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ip_address VARCHAR(100),
    user_agent TEXT,
    country_code VARCHAR(10),
    is_claimed BOOLEAN NOT NULL DEFAULT false
);

-- Table pour les éditeurs (blogueurs, propriétaires de sites)
CREATE TABLE IF NOT EXISTS ad_publishers (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    publisher_id VARCHAR(255) NOT NULL UNIQUE,
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, active, rejected
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table pour les campagnes publicitaires créées par les annonceurs
CREATE TABLE IF NOT EXISTS ad_campaigns (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    name VARCHAR(255) NOT NULL,
    target_url VARCHAR(2048) NOT NULL,
    image_url VARCHAR(2048),
    format VARCHAR(50) NOT NULL,
    budget NUMERIC(10, 2) NOT NULL,
    duration_days INTEGER NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending_approval',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- [Table 2: user_sessions]
CREATE TABLE user_sessions (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    user_agent_details JSONB,
    login_time TIMESTAMPTZ DEFAULT NOW(),
    logout_time TIMESTAMPTZ,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- [Table 3: user_documents]
CREATE TABLE user_documents (
    id SERIAL PRIMARY KEY,
    user_id INT UNIQUE NOT NULL,
    id_type VARCHAR(50) NOT NULL CHECK (id_type IN ('national_id', 'passport', 'driver_license', 'biometric_passport', 'diplomatic_passport', 'consular_card')),
    id_number VARCHAR(100) UNIQUE NOT NULL,
    id_issued_date DATE,
    id_expiry_date DATE,
    id_front_image TEXT,
    id_back_image TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- [Table 4: user_verifications]
CREATE TABLE user_verifications (
    id SERIAL PRIMARY KEY,
    user_id INT UNIQUE NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('blue', 'green', 'red', 'pending')),
    notes TEXT,
    verified_by_admin_id INT,
    verified_at TIMESTAMPTZ,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (verified_by_admin_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE otps (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    code VARCHAR(6) NOT NULL,
    type VARCHAR(50) NOT NULL,
    channel VARCHAR(20) CHECK (channel IN ('sms', 'email', 'whatsapp', 'in-app')),
    expires_at TIMESTAMPTZ NOT NULL,
    used BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE registration_otps (
    id SERIAL PRIMARY KEY,
    destination VARCHAR(255) NOT NULL,
    code VARCHAR(6) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE push_subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    endpoint TEXT UNIQUE NOT NULL,
    subscription_data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);


-- [Table 10: revenue_wallets]
CREATE TABLE revenue_wallets (
    id SERIAL PRIMARY KEY,
    wallet_id VARCHAR(12) UNIQUE NOT NULL,
    revenue_type VARCHAR(50) NOT NULL, -- e.g., 'transaction_fees', 'event_commission'
    country_code VARCHAR(2) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    description TEXT,
    FOREIGN KEY (wallet_id) REFERENCES wallets(id_wallet)
);

-- Créer la table avec from_currency et to_currency
CREATE TABLE exchange_rates (
    id SERIAL PRIMARY KEY,
    country_code VARCHAR(2) NOT NULL,
    from_currency VARCHAR(10) NOT NULL,
    to_currency VARCHAR(10) NOT NULL,
    rate NUMERIC(15, 8) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (country_code, from_currency, to_currency)
);

CREATE TABLE fee_structures (
    id SERIAL PRIMARY KEY,
    country_code VARCHAR(3) NOT NULL,
    transaction_type VARCHAR(50) NOT NULL,
    currency VARCHAR(10) NOT NULL,
    fee_tiers JSONB NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT unique_fee_structure UNIQUE (country_code, transaction_type, currency)
);

CREATE TABLE card_inventory (
    id SERIAL PRIMARY KEY,
    card_provider_id VARCHAR(255) UNIQUE,
    pan_token VARCHAR(255) UNIQUE,
    last4 VARCHAR(4),
    exp_month INT,
    exp_year INT,
    cvv_encrypted TEXT,
    brand VARCHAR(20) CHECK (brand IN ('visa', 'mastercard')),
    currency VARCHAR(10),
    status VARCHAR(20) DEFAULT 'IN_STOCK' CHECK (status IN ('IN_STOCK', 'ASSIGNED', 'DEFECTIVE')),
    added_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE cards (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    card_provider_id VARCHAR(255) UNIQUE,
    inventory_id INT UNIQUE,
    card_type VARCHAR(20) NOT NULL CHECK (card_type IN ('virtuelle', 'physique')),
    brand VARCHAR(20) NOT NULL CHECK (brand IN ('visa', 'mastercard')),
    currency VARCHAR(10) NOT NULL,
    number VARCHAR(255),
    last4 VARCHAR(4),
    exp_month INT,
    exp_year INT,
    cvv_encrypted TEXT,
    status VARCHAR(20) DEFAULT 'inactive' CHECK (status IN ('active', 'inactive', 'cancelled', 'pending_cancellation')),
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (inventory_id) REFERENCES card_inventory(id) ON DELETE SET NULL
);

-- [Table 15: card_requests]
CREATE TABLE card_requests (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    card_type VARCHAR(20) NOT NULL CHECK (card_type = 'physique'),
    brand VARCHAR(20) NOT NULL CHECK (brand IN ('visa', 'mastercard')),
    currency VARCHAR(10) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'ready_for_pickup', 'completed', 'cancelled')),
    fee_transaction_id INT,
    assigned_card_id INT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (fee_transaction_id) REFERENCES transactions(id) ON DELETE SET NULL,
    FOREIGN KEY (assigned_card_id) REFERENCES cards(id) ON DELETE SET NULL
);

CREATE TABLE card_transaction_controls (
    id SERIAL PRIMARY KEY,
    card_id INT NOT NULL,
    control_type VARCHAR(50) NOT NULL CHECK (control_type IN ('VELOCITY_LIMIT', 'ECOMMERCE', 'POS', 'ATM', 'RECURRING', 'MERCHANT_CATEGORY')),
    is_blocked BOOLEAN DEFAULT false,
    limit_value NUMERIC(15, 2),
    time_window VARCHAR(20) CHECK (time_window IN ('TRANSACTION', 'DAY', 'WEEK', 'MONTH', 'LIFETIME')),
    mcc VARCHAR(10),
    UNIQUE (card_id, control_type, mcc, time_window),
    FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE
);

-- [Table 17: saved_user_cards]
CREATE TABLE saved_user_cards (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    card_brand VARCHAR(20) NOT NULL,
    card_holder_name VARCHAR(255) NOT NULL,
    last4 VARCHAR(4) NOT NULL,
    expiry_month VARCHAR(2) NOT NULL,
    expiry_year VARCHAR(4) NOT NULL,
    card_token TEXT NOT NULL, -- This should be a token from the payment provider, not the full card number
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, last4, expiry_month, expiry_year),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE linked_bank_accounts (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    provider VARCHAR(50) NOT NULL DEFAULT 'mastercard',
    institution_name VARCHAR(255) NOT NULL,
    account_type VARCHAR(50),
    account_number_mask VARCHAR(50) NOT NULL,
    provider_account_id VARCHAR(255) UNIQUE NOT NULL,
    mastercard_access_token TEXT, -- Should be encrypted
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE agencies (
    id SERIAL PRIMARY KEY,
    agency_code VARCHAR(10) NOT NULL,
    name VARCHAR(255) NOT NULL,
    address VARCHAR(255),
    city VARCHAR(100),
    country_code CHAR(2),
    is_active BOOLEAN,
    created_at TIMESTAMP
);

INSERT INTO agencies (id, agency_code, name, address, city, country_code, is_active, created_at) VALUES
(1, 'ZA01', 'CashPay Afrique du Sud', 'Adresse par défaut', 'Afrique du Sud', 'ZA', TRUE, '2025-07-24 11:35:08'),
(2, 'DZ01', 'CashPay Algérie', 'Adresse par défaut', 'Algérie', 'DZ', TRUE, '2025-07-24 11:35:08'),
(3, 'AO01', 'CashPay Angola', 'Adresse par défaut', 'Angola', 'AO', TRUE, '2025-07-24 11:35:08'),
(4, 'BJ01', 'CashPay Bénin', 'Adresse par défaut', 'Bénin', 'BJ', TRUE, '2025-07-24 11:35:08'),
(5, 'BW01', 'CashPay Botswana', 'Adresse par défaut', 'Botswana', 'BW', TRUE, '2025-07-24 11:35:08'),
(6, 'BF01', 'CashPay Burkina Faso', 'Adresse par défaut', 'Burkina Faso', 'BF', TRUE, '2025-07-24 11:35:08'),
(7, 'BI01', 'CashPay Burundi', 'Adresse par défaut', 'Burundi', 'BI', TRUE, '2025-07-24 11:35:08'),
(8, 'CV01', 'CashPay Cap-Vert', 'Adresse par défaut', 'Cap-Vert', 'CV', TRUE, '2025-07-24 11:35:08'),
(9, 'CM01', 'CashPay Cameroun', 'Adresse par défaut', 'Cameroun', 'CM', TRUE, '2025-07-24 11:35:08'),
(10, 'CF01', 'CashPay République Centrafricaine', 'Adresse par défaut', 'République Centrafricaine', 'CF', TRUE, '2025-07-24 11:35:08'),
(11, 'KM01', 'CashPay Comores', 'Adresse par défaut', 'Comores', 'KM', TRUE, '2025-07-24 11:35:08'),
(12, 'CG01', 'CashPay Congo (Brazzaville)', 'Adresse par défaut', 'Congo (Brazzaville)', 'CG', TRUE, '2025-07-24 11:35:08'),
(13, 'CD01', 'CashPay Congo (Kinshasa)', 'Adresse par défaut', 'Congo (Kinshasa)', 'CD', TRUE, '2025-07-24 11:35:08'),
(14, 'CI01', 'CashPay Côte d’Ivoire', 'Adresse par défaut', 'Côte d’Ivoire', 'CI', TRUE, '2025-07-24 11:35:08'),
(15, 'DJ01', 'CashPay Djibouti', 'Adresse par défaut', 'Djibouti', 'DJ', TRUE, '2025-07-24 11:35:08'),
(16, 'EG01', 'CashPay Égypte', 'Adresse par défaut', 'Égypte', 'EG', TRUE, '2025-07-24 11:35:08'),
(17, 'ER01', 'CashPay Érythrée', 'Adresse par défaut', 'Érythrée', 'ER', TRUE, '2025-07-24 11:35:08'),
(18, 'SZ01', 'CashPay Eswatini', 'Adresse par défaut', 'Eswatini', 'SZ', TRUE, '2025-07-24 11:35:08'),
(19, 'ET01', 'CashPay Éthiopie', 'Adresse par défaut', 'Éthiopie', 'ET', TRUE, '2025-07-24 11:35:08'),
(20, 'GA01', 'CashPay Gabon', 'Adresse par défaut', 'Gabon', 'GA', TRUE, '2025-07-24 11:35:08'),
(21, 'GM01', 'CashPay Gambie', 'Adresse par défaut', 'Gambie', 'GM', TRUE, '2025-07-24 11:35:08'),
(22, 'GH01', 'CashPay Ghana', 'Adresse par défaut', 'Ghana', 'GH', TRUE, '2025-07-24 11:35:08'),
(23, 'GN01', 'CashPay Guinée', 'Adresse par défaut', 'Guinée', 'GN', TRUE, '2025-07-24 11:35:08'),
(24, 'GW01', 'CashPay Guinée-Bissau', 'Adresse par défaut', 'Guinée-Bissau', 'GW', TRUE, '2025-07-24 11:35:08'),
(25, 'GQ01', 'CashPay Guinée équatoriale', 'Adresse par défaut', 'Guinée équatoriale', 'GQ', TRUE, '2025-07-24 11:35:08'),
(26, 'KE01', 'CashPay Kenya', 'Adresse par défaut', 'Kenya', 'KE', TRUE, '2025-07-24 11:35:08'),
(27, 'LS01', 'CashPay Lesotho', 'Adresse par défaut', 'Lesotho', 'LS', TRUE, '2025-07-24 11:35:08'),
(28, 'LR01', 'CashPay Liberia', 'Adresse par défaut', 'Liberia', 'LR', TRUE, '2025-07-24 11:35:08'),
(29, 'LY01', 'CashPay Libye', 'Adresse par défaut', 'Libye', 'LY', TRUE, '2025-07-24 11:35:08'),
(30, 'MG01', 'CashPay Madagascar', 'Adresse par défaut', 'Madagascar', 'MG', 1, '2025-07-24 11:35:08'),
(31, 'MW01', 'CashPay Malawi', 'Adresse par défaut', 'Malawi', 'MW', TRUE, '2025-07-24 11:35:08'),
(32, 'ML01', 'CashPay Mali', 'Adresse par défaut', 'Mali', 'ML', TRUE, '2025-07-24 11:35:08'),
(33, 'MA01', 'CashPay Maroc', 'Adresse par défaut', 'Maroc', 'MA', TRUE, '2025-07-24 11:35:08'),
(34, 'MU01', 'CashPay Maurice', 'Adresse par défaut', 'Maurice', 'MU', TRUE, '2025-07-24 11:35:08'),
(35, 'MR01', 'CashPay Mauritanie', 'Adresse par défaut', 'Mauritanie', 'MR', TRUE, '2025-07-24 11:35:08'),
(36, 'MZ01', 'CashPay Mozambique', 'Adresse par défaut', 'Mozambique', 'MZ', TRUE, '2025-07-24 11:35:08'),
(37, 'NA01', 'CashPay Namibie', 'Adresse par défaut', 'Namibie', 'NA', TRUE, '2025-07-24 11:35:08'),
(38, 'NE01', 'CashPay Niger', 'Adresse par défaut', 'Niger', 'NE', TRUE, '2025-07-24 11:35:08'),
(39, 'NG01', 'CashPay Nigeria', 'Adresse par défaut', 'Nigeria', 'NG', TRUE, '2025-07-24 11:35:08'),
(40, 'RW01', 'CashPay Rwanda', 'Adresse par défaut', 'Rwanda', 'RW', TRUE, '2025-07-24 11:35:08'),
(41, 'ST01', 'CashPay Sao Tomé-et-Principe', 'Adresse par défaut', 'Sao Tomé-et-Principe', 'ST', TRUE, '2025-07-24 11:35:08'),
(42, 'SN01', 'CashPay Sénégal', 'Adresse par défaut', 'Sénégal', 'SN', TRUE, '2025-07-24 11:35:08'),
(43, 'SC01', 'CashPay Seychelles', 'Adresse par défaut', 'Seychelles', 'SC', TRUE, '2025-07-24 11:35:08'),
(44, 'SL01', 'CashPay Sierra Leone', 'Adresse par défaut', 'Sierra Leone', 'SL', TRUE, '2025-07-24 11:35:08'),
(45, 'SO01', 'CashPay Somalie', 'Adresse par défaut', 'Somalie', 'SO', TRUE, '2025-07-24 11:35:08'),
(46, 'SD01', 'CashPay Soudan', 'Adresse par défaut', 'Soudan', 'SD', TRUE, '2025-07-24 11:35:08'),
(47, 'SS01', 'CashPay Soudan du Sud', 'Adresse par défaut', 'Soudan du Sud', 'SS', TRUE, '2025-07-24 11:35:08'),
(48, 'TZ01', 'CashPay Tanzanie', 'Adresse par défaut', 'Tanzanie', 'TZ', TRUE, '2025-07-24 11:35:08'),
(49, 'TD01', 'CashPay Tchad', 'Adresse par défaut', 'Tchad', 'TD', TRUE, '2025-07-24 11:35:08'),
(50, 'TG01', 'CashPay Togo', 'Adresse par défaut', 'Togo', 'TG', TRUE, '2025-07-24 11:35:08'),
(51, 'TN01', 'CashPay Tunisie', 'Adresse par défaut', 'Tunisie', 'TN', TRUE, '2025-07-24 11:35:08'),
(52, 'UG01', 'CashPay Ouganda', 'Adresse par défaut', 'Ouganda', 'UG', TRUE, '2025-07-24 11:35:08'),
(53, 'ZM01', 'CashPay Zambie', 'Adresse par défaut', 'Zambie', 'ZM', TRUE, '2025-07-24 11:35:08'),
(54, 'ZW01', 'CashPay Zimbabwe', 'Adresse par défaut', 'Zimbabwe', 'ZW', TRUE, '2025-07-24 11:35:08'),
(55, 'CA01', 'CashPay Canada', 'Adresse par défaut', 'Canada', 'CA', TRUE, '2025-07-24 11:35:08'),
(56, 'US01', 'CashPay États-Unis', 'Adresse par défaut', 'États-Unis', 'US', TRUE, '2025-07-24 11:35:08'),
(57, 'MX01', 'CashPay Mexique', 'Adresse par défaut', 'Mexique', 'MX', TRUE, '2025-07-24 11:35:08'),
(58, 'AG01', 'CashPay Antigua-et-Barbuda', 'Adresse par défaut', 'Antigua-et-Barbuda', 'AG', TRUE, '2025-07-24 11:35:08'),
(59, 'BS01', 'CashPay Bahamas', 'Adresse par défaut', 'Bahamas', 'BS', TRUE, '2025-07-24 11:35:08'),
(60, 'BB01', 'CashPay Barbade', 'Adresse par défaut', 'Barbade', 'BB', TRUE, '2025-07-24 11:35:08'),
(61, 'BZ01', 'CashPay Belize', 'Adresse par défaut', 'Belize', 'BZ', TRUE, '2025-07-24 11:35:08'),
(62, 'CR01', 'CashPay Costa Rica', 'Adresse par défaut', 'Costa Rica', 'CR', TRUE, '2025-07-24 11:35:08'),
(63, 'CU01', 'CashPay Cuba', 'Adresse par défaut', 'Cuba', 'CU', TRUE, '2025-07-24 11:35:08'),
(64, 'DM01', 'CashPay Dominique', 'Adresse par défaut', 'Dominique', 'DM', TRUE, '2025-07-24 11:35:08'),
(65, 'DO01', 'CashPay République dominicaine', 'Adresse par défaut', 'République dominicaine', 'DO', TRUE, '2025-07-24 11:35:08'),
(66, 'SV01', 'CashPay El Salvador', 'Adresse par défaut', 'El Salvador', 'SV', TRUE, '2025-07-24 11:35:08'),
(67, 'GD01', 'CashPay Grenade', 'Adresse par défaut', 'Grenade', 'GD', TRUE, '2025-07-24 11:35:08'),
(68, 'GT01', 'CashPay Guatemala', 'Adresse par défaut', 'Guatemala', 'GT', TRUE, '2025-07-24 11:35:08'),
(69, 'HT01', 'CashPay Haïti', 'Adresse par défaut', 'Haïti', 'HT', TRUE, '2025-07-24 11:35:08'),
(70, 'HN01', 'CashPay Honduras', 'Adresse par défaut', 'Honduras', 'HN', TRUE, '2025-07-24 11:35:08'),
(71, 'JM01', 'CashPay Jamaïque', 'Adresse par défaut', 'Jamaïque', 'JM', TRUE, '2025-07-24 11:35:08'),
(72, 'NI01', 'CashPay Nicaragua', 'Adresse par défaut', 'Nicaragua', 'NI', TRUE, '2025-07-24 11:35:08'),
(73, 'PA01', 'CashPay Panama', 'Adresse par défaut', 'Panama', 'PA', TRUE, '2025-07-24 11:35:08'),
(74, 'KN01', 'CashPay Saint-Kitts-et-Nevis', 'Adresse par défaut', 'Saint-Kitts-et-Nevis', 'KN', TRUE, '2025-07-24 11:35:08'),
(75, 'LC01', 'CashPay Sainte-Lucie', 'Adresse par défaut', 'Sainte-Lucie', 'LC', TRUE, '2025-07-24 11:35:08'),
(76, 'VC01', 'CashPay Saint-Vincent-et-les-Grenadines', 'Adresse par défaut', 'Saint-Vincent-et-les-Grenadines', 'VC', TRUE, '2025-07-24 11:35:08'),
(77, 'TT01', 'CashPay Trinité-et-Tobago', 'Adresse par défaut', 'Trinité-et-Tobago', 'TT', TRUE, '2025-07-24 11:35:08'),
(78, 'AR01', 'CashPay Argentine', 'Adresse par défaut', 'Argentine', 'AR', TRUE, '2025-07-24 11:35:08'),
(79, 'BO01', 'CashPay Bolivie', 'Adresse par défaut', 'Bolivie', 'BO', TRUE, '2025-07-24 11:35:08'),
(80, 'BR01', 'CashPay Brésil', 'Adresse par défaut', 'Brésil', 'BR', TRUE, '2025-07-24 11:35:08'),
(81, 'CL01', 'CashPay Chili', 'Adresse par défaut', 'Chili', 'CL', TRUE, '2025-07-24 11:35:08'),
(82, 'CO01', 'CashPay Colombie', 'Adresse par défaut', 'Colombie', 'CO', TRUE, '2025-07-24 11:35:08'),
(83, 'EC01', 'CashPay Équateur', 'Adresse par défaut', 'Équateur', 'EC', TRUE, '2025-07-24 11:35:08'),
(84, 'GY01', 'CashPay Guyana', 'Adresse par défaut', 'Guyana', 'GY', TRUE, '2025-07-24 11:35:08'),
(85, 'PY01', 'CashPay Paraguay', 'Adresse par défaut', 'Paraguay', 'PY', TRUE, '2025-07-24 11:35:08'),
(86, 'PE01', 'CashPay Pérou', 'Adresse par défaut', 'Pérou', 'PE', TRUE, '2025-07-24 11:35:08'),
(87, 'SR01', 'CashPay Suriname', 'Adresse par défaut', 'Suriname', 'SR', TRUE, '2025-07-24 11:35:08'),
(88, 'UY01', 'CashPay Uruguay', 'Adresse par défaut', 'Uruguay', 'UY', TRUE, '2025-07-24 11:35:08'),
(89, 'VE01', 'CashPay Venezuela', 'Adresse par défaut', 'Venezuela', 'VE', TRUE, '2025-07-24 11:35:08'),
(90, 'DE01', 'CashPay Allemagne', 'Adresse par défaut', 'Allemagne', 'DE', TRUE, '2025-07-24 11:35:08'),
(91, 'AD01', 'CashPay Andorre', 'Adresse par défaut', 'Andorre', 'AD', TRUE, '2025-07-24 11:35:08'),
(92, 'AL01', 'CashPay Albanie', 'Adresse par défaut', 'Albanie', 'AL', TRUE, '2025-07-24 11:35:08'),
(93, 'AM01', 'CashPay Arménie', 'Adresse par défaut', 'Arménie', 'AM', TRUE, '2025-07-24 11:35:08'),
(94, 'AT01', 'CashPay Autriche', 'Adresse par défaut', 'Autriche', 'AT', TRUE, '2025-07-24 11:35:08'),
(95, 'AZ01', 'CashPay Azerbaïdjan', 'Adresse par défaut', 'Azerbaïdjan', 'AZ', TRUE, '2025-07-24 11:35:08'),
(96, 'BE01', 'CashPay Belgique', 'Adresse par défaut', 'Belgique', 'BE', TRUE, '2025-07-24 11:35:08'),
(97, 'BY01', 'CashPay Biélorussie', 'Adresse par défaut', 'Biélorussie', 'BY', TRUE, '2025-07-24 11:35:08'),
(98, 'BA01', 'CashPay Bosnie-Herzégovine', 'Adresse par défaut', 'Bosnie-Herzégovine', 'BA', TRUE, '2025-07-24 11:35:08'),
(99, 'BG01', 'CashPay Bulgarie', 'Adresse par défaut', 'Bulgarie', 'BG', TRUE, '2025-07-24 11:35:08'),
(100, 'CY01', 'CashPay Chypre', 'Adresse par défaut', 'Chypre', 'CY', TRUE, '2025-07-24 11:35:08'),
(101, 'HR01', 'CashPay Croatie', 'Adresse par défaut', 'Croatie', 'HR', TRUE, '2025-07-24 11:35:08'),
(102, 'DK01', 'CashPay Danemark', 'Adresse par défaut', 'Danemark', 'DK', TRUE, '2025-07-24 11:35:08'),
(103, 'ES01', 'CashPay Espagne', 'Adresse par défaut', 'Espagne', 'ES', TRUE, '2025-07-24 11:35:08'),
(104, 'EE01', 'CashPay Estonie', 'Adresse par défaut', 'Estonie', 'EE', TRUE, '2025-07-24 11:35:08'),
(105, 'FI01', 'CashPay Finlande', 'Adresse par défaut', 'Finlande', 'FI', TRUE, '2025-07-24 11:35:08'),
(106, 'FR01', 'CashPay France', 'Adresse par défaut', 'France', 'FR', TRUE, '2025-07-24 11:35:08'),
(107, 'GE01', 'CashPay Géorgie', 'Adresse par défaut', 'Géorgie', 'GE', TRUE, '2025-07-24 11:35:08'),
(108, 'GR01', 'CashPay Grèce', 'Adresse par défaut', 'Grèce', 'GR', TRUE, '2025-07-24 11:35:08'),
(109, 'HU01', 'CashPay Hongrie', 'Adresse par défaut', 'Hongrie', 'HU', TRUE, '2025-07-24 11:35:08'),
(110, 'IE01', 'CashPay Irlande', 'Adresse par défaut', 'Irlande', 'IE', TRUE, '2025-07-24 11:35:08'),
(111, 'IS01', 'CashPay Islande', 'Adresse par défaut', 'Islande', 'IS', TRUE, '2025-07-24 11:35:08'),
(112, 'IT01', 'CashPay Italie', 'Adresse par défaut', 'Italie', 'IT', TRUE, '2025-07-24 11:35:08'),
(113, 'KZ01', 'CashPay Kazakhstan', 'Adresse par défaut', 'Kazakhstan', 'KZ', TRUE, '2025-07-24 11:35:08'),
(114, 'XK01', 'CashPay Kosovo', 'Adresse par défaut', 'Kosovo', 'XK', TRUE, '2025-07-24 11:35:08'),
(115, 'LV01', 'CashPay Lettonie', 'Adresse par défaut', 'Lettonie', 'LV', TRUE, '2025-07-24 11:35:08'),
(116, 'LI01', 'CashPay Liechtenstein', 'Adresse par défaut', 'Liechtenstein', 'LI', TRUE, '2025-07-24 11:35:08'),
(117, 'LT01', 'CashPay Lituanie', 'Adresse par défaut', 'Lituanie', 'LT', TRUE, '2025-07-24 11:35:08'),
(118, 'LU01', 'CashPay Luxembourg', 'Adresse par défaut', 'Luxembourg', 'LU', TRUE, '2025-07-24 11:35:08'),
(119, 'MK01', 'CashPay Macédoine du Nord', 'Adresse par défaut', 'Macédoine du Nord', 'MK',TRUE, '2025-07-24 11:35:08'),
(120, 'MT01', 'CashPay Malte', 'Adresse par défaut', 'Malte', 'MT', TRUE, '2025-07-24 11:35:08'),
(121, 'MD01', 'CashPay Moldavie', 'Adresse par défaut', 'Moldavie', 'MD', TRUE, '2025-07-24 11:35:08'),
(122, 'MC01', 'CashPay Monaco', 'Adresse par défaut', 'Monaco', 'MC', TRUE, '2025-07-24 11:35:08'),
(123, 'ME01', 'CashPay Monténégro', 'Adresse par défaut', 'Monténégro', 'ME', TRUE, '2025-07-24 11:35:08'),
(124, 'NO01', 'CashPay Norvège', 'Adresse par défaut', 'Norvège', 'NO', TRUE, '2025-07-24 11:35:08'),
(125, 'NL01', 'CashPay Pays-Bas', 'Adresse par défaut', 'Pays-Bas', 'NL', TRUE, '2025-07-24 11:35:08'),
(126, 'PL01', 'CashPay Pologne', 'Adresse par défaut', 'Pologne', 'PL', TRUE, '2025-07-24 11:35:08'),
(127, 'PT01', 'CashPay Portugal', 'Adresse par défaut', 'Portugal', 'PT', TRUE, '2025-07-24 11:35:08'),
(128, 'CZ01', 'CashPay République tchèque', 'Adresse par défaut', 'République tchèque', 'CZ', TRUE, '2025-07-24 11:35:08'),
(129, 'RO01', 'CashPay Roumanie', 'Adresse par défaut', 'Roumanie', 'RO', TRUE, '2025-07-24 11:35:08'),
(130, 'GB01', 'CashPay Royaume-Uni', 'Adresse par défaut', 'Royaume-Uni', 'GB', TRUE, '2025-07-24 11:35:08'),
(131, 'RU01', 'CashPay Russie', 'Adresse par défaut', 'Russie', 'RU', TRUE, '2025-07-24 11:35:08'),
(132, 'SM01', 'CashPay Saint-Marin', 'Adresse par défaut', 'Saint-Marin', 'SM', TRUE, '2025-07-24 11:35:08'),
(133, 'RS01', 'CashPay Serbie', 'Adresse par défaut', 'Serbie', 'RS', TRUE, '2025-07-24 11:35:08'),
(134, 'SK01', 'CashPay Slovaquie', 'Adresse par défaut', 'Slovaquie', 'SK', TRUE, '2025-07-24 11:35:08'),
(135, 'SI01', 'CashPay Slovénie', 'Adresse par défaut', 'Slovénie', 'SI', TRUE, '2025-07-24 11:35:08'),
(136, 'SE01', 'CashPay Suède', 'Adresse par défaut', 'Suède', 'SE', TRUE, '2025-07-24 11:35:08'),
(137, 'CH01', 'CashPay Suisse', 'Adresse par défaut', 'Suisse', 'CH', TRUE, '2025-07-24 11:35:08'),
(138, 'TR01', 'CashPay Turquie', 'Adresse par défaut', 'Turquie', 'TR', TRUE, '2025-07-24 11:35:08'),
(139, 'UA01', 'CashPay Ukraine', 'Adresse par défaut', 'Ukraine', 'UA', TRUE, '2025-07-24 11:35:08'),
(140, 'VA01', 'CashPay Vatican', 'Adresse par défaut', 'Vatican', 'VA', TRUE, '2025-07-24 11:35:08'),
(141, 'AF01', 'CashPay Afghanistan', 'Adresse par défaut', 'Afghanistan', 'AF', TRUE, '2025-07-24 11:35:08'),
(142, 'SA01', 'CashPay Arabie saoudite', 'Adresse par défaut', 'Arabie saoudite', 'SA', TRUE, '2025-07-24 11:35:08'),
(143, 'BH01', 'CashPay Bahreïn', 'Adresse par défaut', 'Bahreïn', 'BH', TRUE, '2025-07-24 11:35:08'),
(144, 'BD01', 'CashPay Bangladesh', 'Adresse par défaut', 'Bangladesh', 'BD', TRUE, '2025-07-24 11:35:08'),
(145, 'BT01', 'CashPay Bhoutan', 'Adresse par défaut', 'Bhoutan', 'BT', TRUE, '2025-07-24 11:35:08'),
(146, 'MM01', 'CashPay Birmanie (Myanmar)', 'Adresse par défaut', 'Birmanie (Myanmar)', 'MM', TRUE, '2025-07-24 11:35:08'),
(147, 'BN01', 'CashPay Brunei', 'Adresse par défaut', 'Brunei', 'BN', TRUE, '2025-07-24 11:35:08'),
(148, 'KH01', 'CashPay Cambodge', 'Adresse par défaut', 'Cambodge', 'KH', TRUE, '2025-07-24 11:35:08'),
(149, 'CN01', 'CashPay Chine', 'Adresse par défaut', 'Chine', 'CN', TRUE, '2025-07-24 11:35:08'),
(150, 'KP01', 'CashPay Corée du Nord', 'Adresse par défaut', 'Corée du Nord', 'KP', TRUE, '2025-07-24 11:35:08'),
(151, 'KR01', 'CashPay Corée du Sud', 'Adresse par défaut', 'Corée du Sud', 'KR', TRUE, '2025-07-24 11:35:08'),
(152, 'AE01', 'CashPay Émirats arabes unis', 'Adresse par défaut', 'Émirats arabes unis', 'AE', TRUE, '2025-07-24 11:35:08'),
(153, 'IN01', 'CashPay Inde', 'Adresse par défaut', 'Inde', 'IN', TRUE, '2025-07-24 11:35:08'),
(154, 'ID01', 'CashPay Indonésie', 'Adresse par défaut', 'Indonésie', 'ID', TRUE, '2025-07-24 11:35:08'),
(155, 'IR01', 'CashPay Iran', 'Adresse par défaut', 'Iran', 'IR', TRUE, '2025-07-24 11:35:08'),
(156, 'IQ01', 'CashPay Irak', 'Adresse par défaut', 'Irak', 'IQ', TRUE, '2025-07-24 11:35:08'),
(157, 'IL01', 'CashPay Israël', 'Adresse par défaut', 'Israël', 'IL', TRUE, '2025-07-24 11:35:08'),
(158, 'JP01', 'CashPay Japon', 'Adresse par défaut', 'Japon', 'JP', TRUE, '2025-07-24 11:35:08'),
(159, 'JO01', 'CashPay Jordanie', 'Adresse par défaut', 'Jordanie', 'JO', TRUE, '2025-07-24 11:35:08'),
(160, 'KG01', 'CashPay Kirghizistan', 'Adresse par défaut', 'Kirghizistan', 'KG', TRUE, '2025-07-24 11:35:08'),
(161, 'KW01', 'CashPay Koweït', 'Adresse par défaut', 'Koweït', 'KW', TRUE, '2025-07-24 11:35:08'),
(162, 'LA01', 'CashPay Laos', 'Adresse par défaut', 'Laos', 'LA', TRUE, '2025-07-24 11:35:08'),
(163, 'LB01', 'CashPay Liban', 'Adresse par défaut', 'Liban', 'LB', TRUE, '2025-07-24 11:35:08'),
(164, 'MY01', 'CashPay Malaisie', 'Adresse par défaut', 'Malaisie', 'MY', TRUE, '2025-07-24 11:35:08'),
(165, 'MV01', 'CashPay Maldives', 'Adresse par défaut', 'Maldives', 'MV', TRUE, '2025-07-24 11:35:08'),
(166, 'MN01', 'CashPay Mongolie', 'Adresse par défaut', 'Mongolie', 'MN', TRUE, '2025-07-24 11:35:08'),
(167, 'NP01', 'CashPay Népal', 'Adresse par défaut', 'Népal', 'NP', TRUE, '2025-07-24 11:35:08'),
(168, 'OM01', 'CashPay Oman', 'Adresse par défaut', 'Oman', 'OM', TRUE, '2025-07-24 11:35:08'),
(169, 'UZ01', 'CashPay Ouzbékistan', 'Adresse par défaut', 'Ouzbékistan', 'UZ', TRUE, '2025-07-24 11:35:08'),
(170, 'PK01', 'CashPay Pakistan', 'Adresse par défaut', 'Pakistan', 'PK', TRUE, '2025-07-24 11:35:08'),
(171, 'PS01', 'CashPay Palestine', 'Adresse par défaut', 'Palestine', 'PS', TRUE, '2025-07-24 11:35:08'),
(172, 'PH01', 'CashPay Philippines', 'Adresse par défaut', 'Philippines', 'PH', TRUE, '2025-07-24 11:35:08'),
(173, 'QA01', 'CashPay Qatar', 'Adresse par défaut', 'Qatar', 'QA', TRUE, '2025-07-24 11:35:08'),
(174, 'SG01', 'CashPay Singapour', 'Adresse par défaut', 'Singapour', 'SG',  TRUE, '2025-07-24 11:35:08'),
(175, 'LK01', 'CashPay Sri Lanka', 'Adresse par défaut', 'Sri Lanka', 'LK', TRUE, '2025-07-24 11:35:08'),
(176, 'SY01', 'CashPay Syrie', 'Adresse par défaut', 'Syrie', 'SY', TRUE, '2025-07-24 11:35:08'),
(177, 'TJ01', 'CashPay Tadjikistan', 'Adresse par défaut', 'Tadjikistan', 'TJ', TRUE, '2025-07-24 11:35:08'),
(178, 'TW01', 'CashPay Taïwan', 'Adresse par défaut', 'Taïwan', 'TW', TRUE, '2025-07-24 11:35:08'),
(179, 'TH01', 'CashPay Thaïlande', 'Adresse par défaut', 'Thaïlande', 'TH', TRUE, '2025-07-24 11:35:08'),
(180, 'TL01', 'CashPay Timor oriental', 'Adresse par défaut', 'Timor oriental', 'TL', TRUE, '2025-07-24 11:35:08'),
(181, 'TM01', 'CashPay Turkménistan', 'Adresse par défaut', 'Turkménistan', 'TM', TRUE, '2025-07-24 11:35:08'),
(182, 'VN01', 'CashPay Vietnam', 'Adresse par défaut', 'Vietnam', 'VN', TRUE, '2025-07-24 11:35:08'),
(183, 'AU01', 'CashPay Australie', 'Adresse par défaut', 'Australie', 'AU', TRUE, '2025-07-24 11:35:08'),
(184, 'FJ01', 'CashPay Fidji', 'Adresse par défaut', 'Fidji', 'FJ', TRUE, '2025-07-24 11:35:08'),
(185, 'KI01', 'CashPay Kiribati', 'Adresse par défaut', 'Kiribati', 'KI', TRUE, '2025-07-24 11:35:08'),
(186, 'MH01', 'CashPay Îles Marshall', 'Adresse par défaut', 'Îles Marshall', 'MH', TRUE, '2025-07-24 11:35:08'),
(187, 'FM01', 'CashPay États fédérés de Micronésie', 'Adresse par défaut', 'États fédérés de Micronésie', 'FM', TRUE, '2025-07-24 11:35:08'),
(188, 'NR01', 'CashPay Nauru', 'Adresse par défaut', 'Nauru', 'NR', TRUE, '2025-07-24 11:35:08'),
(189, 'NZ01', 'CashPay Nouvelle-Zélande', 'Adresse par défaut', 'Nouvelle-Zélande', 'NZ', TRUE, '2025-07-24 11:35:08'),
(190, 'PW01', 'CashPay Palaos', 'Adresse par défaut', 'Palaos', 'PW', TRUE, '2025-07-24 11:35:08'),
(191, 'PG01', 'CashPay Papouasie-Nouvelle-Guinée', 'Adresse par défaut', 'Papouasie-Nouvelle-Guinée', 'PG', TRUE, '2025-07-24 11:35:08'),
(192, 'SB01', 'CashPay Îles Salomon', 'Adresse par défaut', 'Îles Salomon', 'SB', TRUE, '2025-07-24 11:35:08'),
(193, 'WS01', 'CashPay Samoa', 'Adresse par défaut', 'Samoa', 'WS', TRUE, '2025-07-24 11:35:08'),
(194, 'TO01', 'CashPay Tonga', 'Adresse par défaut', 'Tonga', 'TO', TRUE, '2025-07-24 11:35:08'),
(195, 'TV01', 'CashPay Tuvalu', 'Adresse par défaut', 'Tuvalu', 'TV', TRUE, '2025-07-24 11:35:08'),
(196, 'VU01', 'CashPay Vanuatu', 'Adresse par défaut', 'Vanuatu', 'VU', TRUE, '2025-07-24 11:35:08'),
(197, 'CK01', 'CashPay Îles Cook', 'Adresse par défaut', 'Îles Cook', 'CK', TRUE, '2025-07-24 11:35:08');


-- [Table 20: agency_staff]
CREATE TABLE agency_staff (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    agency_id VARCHAR(2) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('Vendeur', 'Gérant', 'Caissier')),
    is_active BOOLEAN DEFAULT true,
    start_date DATE DEFAULT NOW(),
    end_date DATE,
    monthly_salary_usd NUMERIC(10, 2),
    UNIQUE (user_id, agency_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE
);

-- [Table 21: agent_applications]
CREATE TABLE agent_applications (
    id SERIAL PRIMARY KEY,
    user_id INT UNIQUE NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    capital_amount NUMERIC(15, 2),
    capital_currency VARCHAR(10),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ,
    reviewed_by INT,
    notes TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
);

-- [Table 22: boutiques]
CREATE TABLE boutiques (
    id SERIAL PRIMARY KEY,
    agent_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (agent_id) REFERENCES users(id) ON DELETE CASCADE
);

-- [Table 23: products]
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    agent_id INT NOT NULL,
    boutique_id INT,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    details JSONB,
    images JSONB,
    purchase_price NUMERIC(15, 2),
    selling_price NUMERIC(15, 2) NOT NULL,
    weight NUMERIC(10, 3),
    shipping_rates JSONB,
    promotional_packages JSONB,
    variations JSONB,
    barcode VARCHAR(255) UNIQUE,
    stock INT NOT NULL DEFAULT 0,
    category_id VARCHAR(50),
    is_public BOOLEAN DEFAULT false,
    created_at TIMESTAMptz DEFAULT NOW(),
    updated_at TIMESTAMptz DEFAULT NOW(),
    FOREIGN KEY (agent_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (boutique_id) REFERENCES boutiques(id) ON DELETE SET NULL
);

-- [Table 24: product_losses]
CREATE TABLE product_losses (
    id SERIAL PRIMARY KEY,
    agent_id INT NOT NULL,
    product_id INT NOT NULL,
    product_name VARCHAR(255),
    quantity INT NOT NULL,
    loss_value NUMERIC(15, 2) NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (agent_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_addresses (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    label VARCHAR(50), -- ex: 'Domicile', 'Bureau'
    full_name VARCHAR(255),
    phone VARCHAR(20),
    address TEXT,
    city VARCHAR(100),
    province VARCHAR(100),
    country_code VARCHAR(2),
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Table des articles de la commande
CREATE TABLE IF NOT EXISTS order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id),
    quantity INTEGER NOT NULL,
    unit_price NUMERIC NOT NULL
);

CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    reference VARCHAR(20) UNIQUE NOT NULL, -- Réf publique (ex: ORDER-X123)
    user_id INTEGER NOT NULL REFERENCES users(id), -- L'acheteur
    total_amount NUMERIC NOT NULL,
    currency VARCHAR(3) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending', -- pending, paid, shipped, delivered, cancelled
    transaction_id INTEGER REFERENCES transactions(id), -- Lien vers le paiement financier
    shipping_address_id INTEGER REFERENCES user_addresses(id),
    shipping_cost NUMERIC DEFAULT 0,
    vat_amount NUMERIC DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE shopping_carts (
    id SERIAL PRIMARY KEY,
    user_id INT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE shopping_cart_items (
    id SERIAL PRIMARY KEY,
    cart_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    added_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(cart_id, product_id),
    FOREIGN KEY (cart_id) REFERENCES shopping_carts(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE TABLE wishlists (
    id SERIAL PRIMARY KEY,
    user_id INT UNIQUE NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE wishlist_items (
    id SERIAL PRIMARY KEY,
    wishlist_id INT NOT NULL,
    product_id INT NOT NULL,
    added_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(wishlist_id, product_id),
    FOREIGN KEY (wishlist_id) REFERENCES wishlists(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE TABLE store_followers (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    store_agent_id INT NOT NULL,
    followed_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, store_agent_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (store_agent_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE b2b_partners (
    id SERIAL PRIMARY KEY,
    owner_user_id INT UNIQUE NOT NULL,
    company_name VARCHAR(255) NOT NULL,
    company_address TEXT,
    company_phone VARCHAR(50),
    company_email VARCHAR(255),
    company_website TEXT,
    fiscal_id VARCHAR(100),
    trade_register_id VARCHAR(100),
    company_size VARCHAR(50),
    monthly_turnover VARCHAR(50),
    industry VARCHAR(100),
    services_needed TEXT[],
    developer_role VARCHAR(100),
    status VARCHAR(50) DEFAULT 'pending_verification' CHECK (status IN ('pending_verification', 'active', 'rejected', 'suspended')),
    api_key VARCHAR(255) UNIQUE,
    api_secret_hash VARCHAR(255),
    float_wallet_id VARCHAR(12) UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (float_wallet_id) REFERENCES wallets(id_wallet) ON DELETE SET NULL
);

CREATE TABLE b2b_issued_cards (
    id SERIAL PRIMARY KEY,
    b2b_partner_id INT NOT NULL,
    partner_client_ref VARCHAR(255),
    card_provider_id VARCHAR(255) UNIQUE,
    card_type VARCHAR(20) NOT NULL CHECK (card_type IN ('virtuelle')),
    brand VARCHAR(20) NOT NULL CHECK (brand IN ('visa', 'mastercard')),
    currency VARCHAR(10) NOT NULL,
    number TEXT, -- Encrypted
    last4 VARCHAR(4) NOT NULL,
    exp_month INT NOT NULL,
    exp_year INT NOT NULL,
    cvv_encrypted TEXT,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'terminated')),
    balance NUMERIC(15, 2) DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (b2b_partner_id) REFERENCES b2b_partners(id) ON DELETE CASCADE
);

CREATE TABLE merchants (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    api_key VARCHAR(255) UNIQUE,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE merchant_payments (
    id SERIAL PRIMARY KEY,
    merchant_id VARCHAR(50) NOT NULL,
    amount NUMERIC(15, 2) NOT NULL,
    currency VARCHAR(10) NOT NULL,
    reference VARCHAR(255),
    description TEXT,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
    redirect_url TEXT,
    webhook_url TEXT,
    external_reference VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (merchant_id) REFERENCES merchants(id)
);

- [Table 36: tv_subscriptions]
CREATE TABLE tv_subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    provider_name VARCHAR(100) NOT NULL,
    smartcard_number VARCHAR(100) NOT NULL,
    bouquet_name VARCHAR(100),
    amount NUMERIC(10, 2),
    currency VARCHAR(10),
    transaction_id INT,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled')),
    start_date DATE,
    end_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE SET NULL
);
-- Table des Revendeurs (Stockage des accès API Enterprise)
CREATE TABLE IF NOT EXISTS starlink_resellers (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) UNIQUE, -- Compte CashPay du revendeur
    starlink_account_id VARCHAR(255) NOT NULL, -- "Account Number" Starlink
    api_key TEXT NOT NULL, -- Starlink Client ID
    api_secret TEXT NOT NULL, -- Starlink Client Secret
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des Clients (Lien entre utilisateurs finaux et matériel)
CREATE TABLE IF NOT EXISTS starlink_clients (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) UNIQUE, -- Utilisateur final
    reseller_id INTEGER REFERENCES starlink_resellers(id), -- Le revendeur qui possède le matériel
    kit_serial_number VARCHAR(255) NOT NULL,
    starlink_account_id VARCHAR(255),
    starlink_service_id VARCHAR(255), -- Service Line Number
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- [Table 39: sms_log]
CREATE TABLE sms_log (
    id SERIAL PRIMARY KEY,
    phone_number VARCHAR(20),
    message TEXT,
    status VARCHAR(50),
    provider_response TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE ad_logs (
    id SERIAL PRIMARY KEY,
    campaign_id INT NOT NULL,
    placement_id INT NOT NULL,
    event_type VARCHAR(20) CHECK (event_type IN ('view', 'click')),
    ip_address VARCHAR(45),
    user_agent TEXT,
    country_code VARCHAR(2),
    is_claimed BOOLEAN DEFAULT false,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (campaign_id) REFERENCES ad_campaigns(id) ON DELETE CASCADE,
    FOREIGN KEY (placement_id) REFERENCES ad_placements(id) ON DELETE CASCADE
);

CREATE TABLE countries (
    code VARCHAR(2) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    continent VARCHAR(50),
    dial_code VARCHAR(10),
    currency_name VARCHAR(50),
    currency_code VARCHAR(10),
    currency_symbol VARCHAR(5),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    news_feeds JSONB
);

-- [Table 42: provinces]
CREATE TABLE provinces (
    id SERIAL PRIMARY KEY,
    country_code VARCHAR(2) NOT NULL,
    name VARCHAR(100) NOT NULL,
    FOREIGN KEY (country_code) REFERENCES countries(code) ON DELETE CASCADE
);

CREATE TABLE agent_eligibility_criteria (
    id SERIAL PRIMARY KEY,
    country_code VARCHAR(2) NOT NULL,
    currency_code VARCHAR(10) NOT NULL,
    min_capital_amount NUMERIC(15, 2) NOT NULL,
    UNIQUE(country_code, currency_code)
);

CREATE TABLE referral_settings (
    id SERIAL PRIMARY KEY,
    country_code VARCHAR(2) UNIQUE NOT NULL,
    point_value NUMERIC(10, 2) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true
);

-- [Table 45: conversations]
CREATE TABLE conversations (
    id VARCHAR(255) PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- [Table 46: conversation_participants]
CREATE TABLE conversation_participants (
    id SERIAL PRIMARY KEY,
    conversation_id VARCHAR(255) NOT NULL,
    user_id INT NOT NULL,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (conversation_id, user_id),
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- [Table 47: messages]
CREATE TABLE messages (
    id SERIAL PRIMARY KEY,
    conversation_id VARCHAR(255) NOT NULL,
    sender_id INT NOT NULL,
    content TEXT,
    type VARCHAR(50) DEFAULT 'text' NOT NULL,
    metadata JSONB,
    status VARCHAR(20) DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'read')),
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
);

- [Table 48: notifications]
CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(50) NOT NULL,
    link TEXT,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE statuses (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('text', 'image', 'video')),
    content TEXT NOT NULL,
    background_color VARCHAR(20),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE groups (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    photo_url TEXT,
    currency VARCHAR(10),
    group_wallet_id VARCHAR(12) UNIQUE,
    owner_user_id INT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE RESTRICT,
    FOREIGN KEY (group_wallet_id) REFERENCES wallets(id_wallet) ON DELETE SET NULL
);

CREATE TABLE group_members (
    id SERIAL PRIMARY KEY,
    group_id INT NOT NULL,
    user_id INT NOT NULL,
    role VARCHAR(20) DEFAULT 'member' CHECK (role IN ('member', 'admin')),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'removed')),
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (group_id, user_id),
    FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE group_messages (
    id SERIAL PRIMARY KEY,
    group_id INT NOT NULL,
    sender_id INT NOT NULL,
    content TEXT,
    type VARCHAR(50) DEFAULT 'text' NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
);


-- [Table 53: flight_bookings]
CREATE TABLE flight_bookings (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    booking_reference VARCHAR(50) UNIQUE NOT NULL,
    origin_country VARCHAR(100),
    destination_country VARCHAR(100),
    departure_date DATE,
    return_date DATE,
    booking_status VARCHAR(20) DEFAULT 'pending' CHECK (booking_status IN ('pending', 'confirmed', 'ticketed', 'cancelled', 'rejected')),
    payment_status VARCHAR(20) DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid', 'refunded')),
    total_fare NUMERIC(15, 2),
    currency VARCHAR(10),
    ticket_pdf_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- [Table 54: flight_passengers]
CREATE TABLE flight_passengers (
    id SERIAL PRIMARY KEY,
    booking_id INT NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    date_of_birth DATE NOT NULL,
    passport_number VARCHAR(100),
    FOREIGN KEY (booking_id) REFERENCES flight_bookings(id) ON DELETE CASCADE
);

CREATE TABLE evisa_applications (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    flux_application_id VARCHAR(255) UNIQUE,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    destinationCountry VARCHAR(100),
    visaType VARCHAR(100),
    firstName VARCHAR(100),
    lastName VARCHAR(100),
    dateOfBirth DATE,
    passportNumber VARCHAR(100),
    passportIssueDate DATE,
    passportExpiryDate DATE,
    passportPhotoUrl TEXT,
    passportScanUrl TEXT,
    visa_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE digital_cheques (
    id SERIAL PRIMARY KEY,
    check_number VARCHAR(100) UNIQUE NOT NULL,
    issuer_user_id INT NOT NULL,
    recipient_name VARCHAR(255) NOT NULL,
    amount NUMERIC(15, 2) NOT NULL,
    currency VARCHAR(10) NOT NULL,
    reason TEXT,
    issue_date DATE NOT NULL,
    validity_date DATE,
    status VARCHAR(20) DEFAULT 'valid' CHECK (status IN ('valid', 'cashed', 'cancelled', 'expired')),
    cashing_date DATE,
    cashing_transaction_id INT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (issuer_user_id) REFERENCES users(id) ON DELETE RESTRICT,
    FOREIGN KEY (cashing_transaction_id) REFERENCES transactions(id) ON DELETE SET NULL
);

CREATE TABLE loans (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    wallet_id VARCHAR(12) NOT NULL,
    amount NUMERIC(15, 2) NOT NULL,
    currency VARCHAR(10) NOT NULL,
    interest_rate NUMERIC(5, 4) NOT NULL,
    duration INT NOT NULL, -- in months
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'repaid', 'defaulted')),
    monthly_payment NUMERIC(15, 2),
    remaining_balance NUMERIC(15, 2),
    request_date TIMESTAMPTZ DEFAULT NOW(),
    approval_date TIMESTAMPTZ,
    repayment_start_date DATE,
    next_payment_date DATE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (wallet_id) REFERENCES wallets(id_wallet)
);

CREATE TABLE loan_repayments (
    id SERIAL PRIMARY KEY,
    loan_id INT NOT NULL,
    amount NUMERIC(15, 2) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('repayment', 'penalty')),
    payment_date TIMESTAMPTZ DEFAULT NOW(),
    transaction_id INT,
    FOREIGN KEY (loan_id) REFERENCES loans(id) ON DELETE CASCADE,
    FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE SET NULL
);

-- [Table 59: term_deposits]
CREATE TABLE term_deposits (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    amount NUMERIC(15, 2) NOT NULL,
    currency VARCHAR(10) NOT NULL,
    duration_months INT NOT NULL,
    interest_rate NUMERIC(5, 4) NOT NULL,
    total_return NUMERIC(15, 2),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'matured', 'cancelled')),
    source_transaction_id INT,
    payout_transaction_id INT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    approved_at TIMESTAMPTZ,
    maturity_date DATE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (source_transaction_id) REFERENCES transactions(id) ON DELETE SET NULL,
    FOREIGN KEY (payout_transaction_id) REFERENCES transactions(id) ON DELETE SET NULL
);

CREATE TABLE referrals (
    id SERIAL PRIMARY KEY,
    referrer_user_id INT NOT NULL,
    referred_user_id INT UNIQUE NOT NULL,
    status VARCHAR(50) DEFAULT 'Pending Deposit' CHECK (status IN ('Pending Deposit', 'Active', 'Expired')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (referrer_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (referred_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS referral_settings (
    id SERIAL PRIMARY KEY,
    country_code CHAR(2) UNIQUE,
    point_value NUMERIC(15,2) DEFAULT 100, -- Valeur d'un point en monnaie locale
    currency_code VARCHAR(10) DEFAULT 'CDF'
);

CREATE TABLE chess_moves (
    id SERIAL PRIMARY KEY,
    game_id INT NOT NULL,
    player_id INT NOT NULL,
    move_notation VARCHAR(20) NOT NULL,
    move_fen TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (game_id) REFERENCES chess_games(id) ON DELETE CASCADE,
    FOREIGN KEY (player_id) REFERENCES users(id) ON DELETE CASCADE
);

-- [Table 65: sms_balances]
-- Solde de SMS pour les agents/partenaires.
CREATE TABLE sms_balances (
    user_id INTEGER PRIMARY KEY,
    balance INTEGER NOT NULL DEFAULT 0,
    last_updated TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- [Table 66: sms_purchases]
-- Historique des achats de packs SMS.
CREATE TABLE sms_purchases (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    package_id INTEGER NOT NULL,
    sms_count INTEGER NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(10) NOT NULL,
    date TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    transaction_id INTEGER,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE SET NULL
);

CREATE TABLE sms_campaigns (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    message TEXT NOT NULL,
    recipients_count INTEGER NOT NULL,
    cost_in_sms INTEGER NOT NULL,
    date TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE marketing_campaigns (
    id SERIAL PRIMARY KEY,
    agent_id INTEGER NOT NULL,
    package_name VARCHAR(100) NOT NULL,
    package_cost DECIMAL(10, 2) NOT NULL,
    layout_style VARCHAR(50),
    product_ids JSONB,
    status VARCHAR(20) DEFAULT 'sent',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (agent_id) REFERENCES users(id) ON DELETE CASCADE
);

-- [Table 70: jojo_videos]
-- Contenu vidéo court pour les plateformes JoJo/MonPays.
CREATE TABLE jojo_videos (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    video_url TEXT NOT NULL,
    description TEXT,
    song_title VARCHAR(255),
    likes_count INTEGER DEFAULT 0,
    comments_count INTEGER DEFAULT 0,
    shares_count INTEGER DEFAULT 0,
    bookmarks_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE user_points (
    user_id INTEGER PRIMARY KEY,
    points INTEGER DEFAULT 0,
    source_referral_id INTEGER,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (source_referral_id) REFERENCES referrals(id) ON DELETE SET NULL
);

CREATE TYPE crypto_deposit_status AS ENUM ('unconfirmed', 'confirmed', 'failed');
CREATE TABLE crypto_deposits (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    currency_code VARCHAR(20) NOT NULL,
    amount DECIMAL(20, 8) NOT NULL,
    tx_hash VARCHAR(255) UNIQUE NOT NULL,
    status crypto_deposit_status DEFAULT 'unconfirmed',
    confirmations INTEGER DEFAULT 0,
    required_confirmations INTEGER DEFAULT 3,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- [Table 77: crypto_withdrawals]
-- Demandes de retrait de cryptomonnaies.
CREATE TYPE crypto_withdrawal_status AS ENUM ('pending', 'processing', 'completed', 'failed');
CREATE TABLE crypto_withdrawals (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    currency_code VARCHAR(20) NOT NULL,
    amount DECIMAL(20, 8) NOT NULL,
    recipient_address TEXT NOT NULL,
    status crypto_withdrawal_status DEFAULT 'pending',
    tx_hash VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMPTZ,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE user_crypto_addresses (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    currency_code VARCHAR(20) NOT NULL,
    address VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, currency_code),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- [Table 79: user_crypto_balances]
-- Soldes des cryptomonnaies des utilisateurs.
CREATE TABLE user_crypto_balances (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    currency_code VARCHAR(20) NOT NULL,
    balance DECIMAL(20, 8) DEFAULT 0.00000000,
    UNIQUE(user_id, currency_code),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- [Table 80: fx_portal_users]
-- Utilisateurs du portail FX externe.
CREATE TABLE fx_portal_users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    country_code VARCHAR(10) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (country_code) REFERENCES countries(code)
);

CREATE TYPE atm_status AS ENUM ('Active', 'Inactive', 'Out of Service');
CREATE TABLE atms (
    id VARCHAR(255) PRIMARY KEY,
    location TEXT NOT NULL,
    agency_id VARCHAR(10),
    status atm_status,
    cash_levels JSONB,
    last_transaction TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE SET NULL
);

CREATE TABLE product_comments (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    author_name VARCHAR(255),
    text TEXT NOT NULL,
    parent_comment_id INTEGER,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_comment_id) REFERENCES product_comments(id) ON DELETE CASCADE
);

CREATE TABLE news_articles (
    id SERIAL PRIMARY KEY,
    source VARCHAR(255),
    title TEXT NOT NULL,
    link TEXT UNIQUE NOT NULL,
    pub_date TIMESTAMPTZ,
    author VARCHAR(255),
    content TEXT,
    full_content TEXT,
    content_snippet TEXT,
    image_url TEXT,
    country_code VARCHAR(10),
    continent VARCHAR(50),
    category VARCHAR(100),
    views INTEGER DEFAULT 0,
    likes INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- [Table 86: news_comments]
-- Commentaires des utilisateurs sur les articles.
CREATE TABLE news_comments (
    id SERIAL PRIMARY KEY,
    article_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    author_name VARCHAR(255),
    text TEXT NOT NULL,
    parent_comment_id INTEGER,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (article_id) REFERENCES news_articles(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_comment_id) REFERENCES news_comments(id) ON DELETE CASCADE
);

CREATE TYPE agreement_status AS ENUM ('active', 'cancelled');
CREATE TABLE billing_agreements (
    id VARCHAR(255) PRIMARY KEY,
    user_id INTEGER NOT NULL,
    merchant_name VARCHAR(255),
    merchant_id VARCHAR(255),
    status agreement_status DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- [Table 92: international_transfer_claims]
-- Réclamations de transferts internationaux.
CREATE TABLE international_transfer_claims (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    provider VARCHAR(50) NOT NULL,
    tracking_number VARCHAR(255) NOT NULL,
    expected_amount DECIMAL(15, 2),
    expected_currency VARCHAR(10),
    sender_country VARCHAR(100),
    receive_in_currency VARCHAR(10),
    status VARCHAR(20) DEFAULT 'pending',
    user_document_id INTEGER,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (user_document_id) REFERENCES user_documents(id) ON DELETE SET NULL
);

CREATE TABLE international_transfer_requests (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    provider VARCHAR(50),
    recipient_name VARCHAR(255),
    recipient_country VARCHAR(100),
    recipient_phone VARCHAR(50),
    amount_to_send DECIMAL(15, 2),
    currency VARCHAR(10),
    fee_amount DECIMAL(10, 2),
    total_debited DECIMAL(15, 2),
    status VARCHAR(20) DEFAULT 'pending',
    tracking_number VARCHAR(255),
    source_transaction_id INTEGER,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (source_transaction_id) REFERENCES transactions(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS mlm_network_partners (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) UNIQUE,
    company_name VARCHAR(255) NOT NULL,
    company_type VARCHAR(100),
    product_category VARCHAR(100),
    status VARCHAR(20) DEFAULT 'active', -- On active par défaut pour les tests
    commission_currency VARCHAR(10) DEFAULT 'USD',
    website TEXT,
    description TEXT,
    inactivity_period INTEGER DEFAULT 12,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des rangs (carrière)
CREATE TABLE IF NOT EXISTS mlm_ranks (
    id SERIAL PRIMARY KEY,
    partner_id INTEGER REFERENCES mlm_network_partners(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    level INTEGER NOT NULL,
    min_ppv NUMERIC(15,2) DEFAULT 0,
    min_gv NUMERIC(15,2) DEFAULT 0,
    min_direct_referrals INTEGER DEFAULT 0,
    commission_levels INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE IF NOT EXISTS mlm_network_tree (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) UNIQUE,
    sponsor_id INTEGER REFERENCES users(id),
    binary_parent_id INTEGER REFERENCES users(id),
    binary_position VARCHAR(10) CHECK (binary_position IN ('left', 'right')),
    left_child_id INTEGER REFERENCES users(id),
    right_child_id INTEGER REFERENCES users(id),
    pv_left NUMERIC(15,2) DEFAULT 0,
    pv_right NUMERIC(15,2) DEFAULT 0,
    ppv_current_month NUMERIC(15,2) DEFAULT 0,
    gv_current_month NUMERIC(15,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Paramètres MLM par produit
CREATE TABLE IF NOT EXISTS mlm_product_settings (
    id SERIAL PRIMARY KEY,
    partner_id INTEGER REFERENCES mlm_network_partners(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    points_volume NUMERIC(15,2) DEFAULT 0,
    direct_commission_percentage NUMERIC(5,2) DEFAULT 0,
    level_commissions JSONB,
    binary_commission_percentage NUMERIC(5,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(partner_id, product_id)
);


-- Journal de toutes les commissions MLM gagnées.
CREATE TABLE mlm_commissions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    source_order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
    source_user_id INTEGER REFERENCES users(id),
    commission_type VARCHAR(50) CHECK (commission_type IN ('direct_sale', 'sponsorship', 'binary', 'rank_bonus')),
    amount DECIMAL(10, 4) NOT NULL,
    currency VARCHAR(10) NOT NULL,
    level INTEGER,
    status VARCHAR(20) DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'paid')),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE card_transactions (
    id SERIAL PRIMARY KEY,
    card_id INTEGER NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    amount DECIMAL(15, 2) NOT NULL,
    currency VARCHAR(10) NOT NULL,
    merchant_name VARCHAR(255),
    merchant_mcc VARCHAR(10),
    transaction_time TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20),
    external_id VARCHAR(255) UNIQUE
);


-- [Table 97: fonctionnaires]
CREATE TABLE fonctionnaires (
    id_fonc VARCHAR(255) PRIMARY KEY,
    matricule VARCHAR(100) UNIQUE NOT NULL,
    nom_complet VARCHAR(255) NOT NULL,
    ministere VARCHAR(255),
    fonction VARCHAR(255),
    id_wallet VARCHAR(20) UNIQUE,
    statut VARCHAR(20) CHECK (statut IN ('actif', 'suspendu')),
    base_salary DECIMAL(12, 2),
    salary_currency VARCHAR(10),
    FOREIGN KEY (id_wallet) REFERENCES wallets(id_wallet) ON DELETE SET NULL
);

CREATE TABLE monpays_companies (
    id SERIAL PRIMARY KEY,
    owner_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    owner_wallet_id VARCHAR(50) NOT NULL,
    company_name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    country VARCHAR(10),
    website_url VARCHAR(255),
    address TEXT,
    rccm VARCHAR(100),
    nif VARCHAR(100),
    phone VARCHAR(50),
    email VARCHAR(255),
    logo_url VARCHAR(255),
    cover_photo_url VARCHAR(255),
    status VARCHAR(50) DEFAULT 'pending', -- e.g., 'pending', 'verified', 'rejected'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE monpays_posts (
    id SERIAL PRIMARY KEY,
    author_company_id INTEGER NOT NULL REFERENCES monpays_companies(id) ON DELETE CASCADE,
    content TEXT,
    media_url VARCHAR(2048),
    media_type VARCHAR(50),
    status VARCHAR(50) DEFAULT 'published',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    likes_count INTEGER DEFAULT 0,
    shares_count INTEGER DEFAULT 0,
    is_monetized BOOLEAN DEFAULT false,
    reward_per_share NUMERIC(10, 2) DEFAULT 0
);


CREATE TABLE monpays_stories (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES monpays_companies(id),
    media_url VARCHAR(2048),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ
);

CREATE TABLE user_regideso_abonnements (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    alias VARCHAR(255) NOT NULL,
    abonnement_id VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, abonnement_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE security_keys (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    key_name VARCHAR(100) NOT NULL,
    public_key TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE events (
  id SERIAL PRIMARY KEY,
  owner_user_id INT NOT NULL,
  owner_country_code VARCHAR(2),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  location VARCHAR(255),
  event_date DATE,
  event_time TIME,
  image_url VARCHAR(255),
  status event_status DEFAULT 'active',
  currency VARCHAR(10),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  event_type event_type_enum,
  zoom_event_id VARCHAR(255),
  FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE event_ticket_types (
  id SERIAL PRIMARY KEY,
  event_id INT NOT NULL,
  type_name VARCHAR(100) NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  quantity_total INT NOT NULL,
  quantity_sold INT DEFAULT 0,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

-- [Table 105: tickets]
-- Billets achetés par les utilisateurs.
CREATE TYPE ticket_status AS ENUM ('valid', 'used', 'invalid', 'expired');
CREATE TABLE tickets (
    id SERIAL PRIMARY KEY,
    event_id INT NOT NULL,
    ticket_type_id INT NOT NULL,
    user_id INT NOT NULL,
    ticket_code VARCHAR(100) UNIQUE NOT NULL,
    status ticket_status DEFAULT 'valid',
    purchase_transaction_id INT,
    validation_time TIMESTAMPTZ,
    validated_by INT,
    zoom_join_url TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
    FOREIGN KEY (ticket_type_id) REFERENCES event_ticket_types(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (purchase_transaction_id) REFERENCES transactions(id) ON DELETE SET NULL,
    FOREIGN KEY (validated_by) REFERENCES users(id) ON DELETE SET NULL
);

-- [TABLE 106] mlm_level_commissions
-- Defines the percentage for each sponsorship level (can be partner-specific).
CREATE TABLE mlm_level_commissions (
    id SERIAL PRIMARY KEY,
    partner_id INTEGER,
    level INTEGER NOT NULL,
    percentage NUMERIC(5, 2) NOT NULL,
    UNIQUE(partner_id, level),
    FOREIGN KEY (partner_id) REFERENCES mlm_network_partners(id) ON DELETE CASCADE
);

-- [TABLE 107] mlm_binary_payouts
-- Tracks binary commission payouts to handle weekly/daily caps.
CREATE TABLE mlm_binary_payouts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    amount NUMERIC(15, 2) NOT NULL,
    currency VARCHAR(10) NOT NULL,
    payout_date DATE NOT NULL,
    weaker_leg_volume NUMERIC(15, 2),
    commission_id INTEGER,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (commission_id) REFERENCES mlm_commissions(id) ON DELETE SET NULL
);


-- 5. Historique des Gains (Commissions)
CREATE TABLE IF NOT EXISTS mlm_commissions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    source_order_id INTEGER REFERENCES orders(id),
    source_user_id INTEGER REFERENCES users(id),
    commission_type VARCHAR(50), -- 'direct', 'level', 'binary'
    amount NUMERIC NOT NULL,
    currency VARCHAR(3) NOT NULL,
    level INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS monpays_companies (
    id SERIAL PRIMARY KEY,
    owner_user_id INTEGER NOT NULL REFERENCES users(id),
    company_name VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    country CHAR(2) NOT NULL,
    website_url TEXT,
    address TEXT,
    rccm VARCHAR(100),
    nif VARCHAR(100),
    phone VARCHAR(20),
    email VARCHAR(255),
    logo_url TEXT,
    cover_photo_url TEXT,
    description TEXT,
    status VARCHAR(20) DEFAULT 'pending', -- pending, verified, rejected
    owner_wallet_id VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE card_disputes (
    id SERIAL PRIMARY KEY,
    card_transaction_id INTEGER NOT NULL,
    reason VARCHAR(255) NOT NULL,
    status CHAR(1) NOT NULL,
    amount BIGINT NOT NULL,
    currency CHAR(3) NOT NULL,
    evidence JSONB,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    CONSTRAINT fk_card_transaction
    FOREIGN KEY (card_transaction_id)
    REFERENCES card_transactions(id)
);

-- [TABLE 109]
-- This table records authorization requests that come in real-time from card networks.
CREATE TABLE issuing_authorizations (
    id SERIAL PRIMARY KEY,
    card_id INTEGER NOT NULL,
    amount BIGINT NOT NULL, 
    currency CHAR(3) NOT NULL,
    merchant_name VARCHAR(255),
    merchant_mcc VARCHAR(10),
    merchant_country VARCHAR(2),
    status VARCHAR(20) NOT NULL,
    decision_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    FOREIGN KEY (card_id) REFERENCES b2b_issued_cards(id) ON DELETE CASCADE
);

-- [TABLE 110]
-- This is a crucial step for KYC and compliance.
CREATE TABLE cardholders (
    id SERIAL PRIMARY KEY,
    b2b_partner_id INTEGER,
    type VARCHAR(20) NOT NULL, 
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone_number VARCHAR(50),
    status VARCHAR(20) NOT NULL DEFAULT 'active', 
    billing_address_line1 VARCHAR(255),
    billing_address_city VARCHAR(100),
    billing_address_postal_code VARCHAR(20),
    billing_address_country VARCHAR(2), 
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    FOREIGN KEY (b2b_partner_id) REFERENCES b2b_partners(id) ON DELETE SET NULL
);

CREATE TABLE status_views (
    id SERIAL PRIMARY KEY,
    status_id INTEGER NOT NULL,
    viewer_user_id INTEGER NOT NULL,
    viewed_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(status_id, viewer_user_id),
    FOREIGN KEY (status_id) REFERENCES statuses(id) ON DELETE CASCADE,
    FOREIGN KEY (viewer_user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- [TABLE 112] meeting_subscriptions
CREATE TABLE meeting_subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE NOT NULL,
    plan_type VARCHAR(50),
    status VARCHAR(20),
    start_date DATE,
    end_date DATE,
    transaction_id INTEGER,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE SET NULL
);

-- [TABLE 113]
-- Meetings
CREATE TABLE meetings (
    "id" SERIAL PRIMARY KEY,
    "host_id" INT NOT NULL,
    "attendees" JSONB,
    "status" VARCHAR(20) DEFAULT 'pending',
    "type" VARCHAR(10) DEFAULT 'audio',
    "max_participants" INT DEFAULT 5,
    "cost" DECIMAL(10, 2) DEFAULT 0.00,
    "currency" VARCHAR(10) DEFAULT 'USD',
    "started_at" TIMESTAMP WITH TIME ZONE,
    "ended_at" TIMESTAMP WITH TIME ZONE,
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (host_id) REFERENCES users(id) ON DELETE CASCADE
);

-- [TABLE 114]
CREATE TABLE meeting_participants (
    "id" SERIAL PRIMARY KEY,
    "meeting_id" INT NOT NULL,
    "user_id" INT NOT NULL,
    "joined_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE("meeting_id", "user_id"),
    FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE payout_transactions (
    id SERIAL PRIMARY KEY,
    b2b_partner_id INTEGER,
    type VARCHAR(50),
    amount NUMERIC(15, 2),
    currency VARCHAR(10),
    recipient_identifier VARCHAR(255),
    reference VARCHAR(255) UNIQUE,
    status VARCHAR(20), 
    source_transaction_id INTEGER,
    provider_response JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (b2b_partner_id) REFERENCES b2b_partners(id) ON DELETE SET NULL,
    FOREIGN KEY (source_transaction_id) REFERENCES transactions(id) ON DELETE SET NULL
);

CREATE TABLE agent_subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'inactive', -- active, expired, cancelled
    current_period_end TIMESTAMPTZ,
    is_promo_period BOOLEAN DEFAULT FALSE,
    auto_renew BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id)
);

CREATE TABLE IF NOT EXISTS post_likes (
    post_id INTEGER REFERENCES monpays_posts(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY(post_id, user_id)
);

-- Suivi des partages rémunérés (anti-fraude)
CREATE TABLE IF NOT EXISTS post_shares (
    id SERIAL PRIMARY KEY,
    post_id INTEGER REFERENCES monpays_posts(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    amount_earned NUMERIC(15,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(post_id, user_id) -- Un gain par utilisateur par publication
);

CREATE TABLE IF NOT EXISTS share_clicks (
    id SERIAL PRIMARY KEY,
    share_id INTEGER REFERENCES post_shares(id) ON DELETE CASCADE,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(share_id, ip_address) 
);


CREATE TABLE IF NOT EXISTS monpays_page_visits (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES monpays_companies(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table pour le suivi des clics uniques (anti-fraude)
CREATE TABLE IF NOT EXISTS share_clicks (
    id SERIAL PRIMARY KEY,
    share_id INTEGER REFERENCES post_shares(id) ON DELETE CASCADE,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(share_id, ip_address) 
);

-- Suivi des abonnés aux boutiques JoJo
CREATE TABLE IF NOT EXISTS store_followers (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    store_agent_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, store_agent_id)
);

-- Suivi des abonnés aux pages MonPays
CREATE TABLE IF NOT EXISTS company_followers (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    company_id INTEGER REFERENCES monpays_companies(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, company_id)
);

CREATE TABLE IF NOT EXISTS monpays_comments (
    id SERIAL PRIMARY KEY,
    post_id INTEGER REFERENCES monpays_posts(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table pour l'audit souverain des interventions administratives
-- Permet de tracer quel Super Agent ou Sous-Agent est intervenu sur quel client
CREATE TABLE IF NOT EXISTS super_agent_interventions (
    id SERIAL PRIMARY KEY,
    admin_user_id INTEGER REFERENCES users(id), -- L'agent qui intervient
    target_user_id INTEGER REFERENCES users(id), -- Le client impacté
    action_type VARCHAR(50) NOT NULL,           -- Type: PIN_RESET, KYC_UPDATE, etc.
    detail TEXT,                                 -- Description textuelle ou JSON
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE hsm_signatures (
    id SERIAL PRIMARY KEY,
    transaction_id INTEGER REFERENCES transactions(id),
    user_id INTEGER REFERENCES users(id),
    signature_hash TEXT UNIQUE NOT NULL, -- Le hash sha256 généré
    status VARCHAR(20) DEFAULT 'active', -- 'active', 'used' (mort), 'cancelled'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE agent_subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE REFERENCES users(id),
    status VARCHAR(20) DEFAULT 'active', -- 'active', 'expired', 'cancelled'
    current_period_end TIMESTAMP,        -- Date d'expiration (J+30)
    is_promo_period BOOLEAN DEFAULT false,
    auto_renew BOOLEAN DEFAULT true,     -- Pour le moteur de renouvellement automatique
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE super_agent_interventions (
    id SERIAL PRIMARY KEY,
    admin_user_id INTEGER REFERENCES users(id),
    target_user_id INTEGER REFERENCES users(id), -- Peut être NULL pour une action globale
    action_type VARCHAR(50) NOT NULL,            -- 'STATUS_TOGGLE', 'PIN_RESET', 'SOV_DEP'
    detail TEXT,                                 -- Motif ou description de l'action
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE product_losses (
    id SERIAL PRIMARY KEY,
    agent_id INTEGER REFERENCES users(id),
    product_id INTEGER,
    product_name TEXT,
    quantity INTEGER,
    loss_value DECIMAL(15,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. ÉCOSYSTÈME MONPAYS (RÉSEAU SOCIAL D'ENTREPRISE)
CREATE TABLE monpays_companies (
    id SERIAL PRIMARY KEY,
    owner_user_id INTEGER REFERENCES users(id),
    owner_wallet_id VARCHAR(20),
    company_name TEXT NOT NULL,
    category VARCHAR(100),
    country VARCHAR(100),
    website_url TEXT,
    address TEXT,
    rccm VARCHAR(50),
    nif VARCHAR(50),
    phone VARCHAR(20),
    email VARCHAR(100),
    logo_url TEXT,
    cover_photo_url TEXT,
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'verified', 'rejected'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE monpays_posts (
    id SERIAL PRIMARY KEY,
    author_company_id INTEGER REFERENCES monpays_companies(id),
    content TEXT,
    media_url TEXT,
    media_type VARCHAR(20),
    status VARCHAR(20) DEFAULT 'published',
    views_count INTEGER DEFAULT 0,
    is_monetized BOOLEAN DEFAULT false,
    monetization_budget DECIMAL(15,2) DEFAULT 0,
    reward_per_share DECIMAL(15,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE post_shares (
    id SERIAL PRIMARY KEY,
    post_id INTEGER REFERENCES monpays_posts(id),
    user_id INTEGER REFERENCES users(id),
    platform VARCHAR(50),
    tracking_id VARCHAR(50) UNIQUE, -- ID unique pour le lien de partage rémunéré
    click_count INTEGER DEFAULT 0,
    is_paid BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS hotel_establishments (
    id SERIAL PRIMARY KEY,
    owner_user_id INTEGER REFERENCES users(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(50), -- Standard, Luxe, etc.
    country VARCHAR(100) NOT NULL,
    province VARCHAR(100),
    city VARCHAR(100) NOT NULL,
    address TEXT NOT NULL,
    phone VARCHAR(20),
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des chambres d'Hôtels
CREATE TABLE IF NOT EXISTS hotel_rooms (
    id SERIAL PRIMARY KEY,
    hotel_id INTEGER REFERENCES hotel_establishments(id) ON DELETE CASCADE,
    room_type VARCHAR(100) NOT NULL,
    price NUMERIC(15, 2) NOT NULL,
    description TEXT,
    images JSONB DEFAULT '[]', -- Stocke jusqu'à 4 URLs
    is_available BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


CREATE TABLE hardware_keys (
    id SERIAL PRIMARY KEY,
    key_reference VARCHAR(50) UNIQUE NOT NULL, -- Réf publique (ex: HSM-XXXX)
    owner_user_id INTEGER REFERENCES users(id), -- Client titulaire
    issuer_partner_id INTEGER REFERENCES b2b_partners(id), -- Partenaire émetteur
    issuer_fleet_wallet_id VARCHAR(12) NOT NULL, -- Compte flotte garant (Relatif à l'émetteur)
    issuing_bank_name VARCHAR(100) NOT NULL, -- Nom de la banque d'origine
    issuing_country_code VARCHAR(5) NOT NULL, -- Pays d'origine de la monnaie
    amount NUMERIC(15, 2) NOT NULL,
    currency VARCHAR(5) NOT NULL,
    security_level VARCHAR(20) DEFAULT 'none',
    pin_hash VARCHAR(255),
    hsm_signature TEXT UNIQUE NOT NULL, -- Secret cryptographique (64 chars)
    status VARCHAR(20) DEFAULT 'active',
    source_transaction_id INTEGER REFERENCES transactions(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    claimed_at TIMESTAMP,
    cancelled_at TIMESTAMP
);

CREATE TABLE dev_portal_users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    company_name VARCHAR(100) NOT NULL,
    manager_name VARCHAR(100) NOT NULL,
    employee_count INT NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    phone VARCHAR(20),
    password_hash VARCHAR(255) NOT NULL,
    b2b_user_id INT, -- Nullable, Foreign key to the main 'users' table
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (b2b_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE otp_codes (
    id SERIAL PRIMARY KEY,
    email VARCHAR(100) NOT NULL,
    code VARCHAR(6) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    type VARCHAR(20) NOT NULL, -- e.g., 'dev_signup', 'dev_login', 'transaction'
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (email, type) -- A user can only have one active OTP of a certain type at a time
);

CREATE TABLE hardware_keys (
    id SERIAL PRIMARY KEY,
    signature VARCHAR(64) NOT NULL UNIQUE,
    issuer_partner_id INT NOT NULL,
    amount NUMERIC(15, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    key_pin_hash VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active', -- 'active', 'claimed', 'cancelled'
    reference VARCHAR(50) UNIQUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    claimed_at TIMESTAMPTZ,
    claimed_by_partner_id INT,
    FOREIGN KEY (issuer_partner_id) REFERENCES users(id),
    FOREIGN KEY (claimed_by_partner_id) REFERENCES users(id)
);

CREATE TABLE b2b_sms_balances (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,
    balance INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE payment_sessions (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(255) NOT NULL UNIQUE,
    partner_id INT NOT NULL,
    amount NUMERIC(15, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    reference VARCHAR(100),
    description VARCHAR(255),
    redirect_url VARCHAR(1024),
    webhook_url VARCHAR(1024),
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'completed', 'failed', 'expired'
    customer_name VARCHAR(100),
    customer_email VARCHAR(100),
    customer_phone VARCHAR(20),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (partner_id) REFERENCES users(id)
);

CREATE TABLE b2b_service_subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL, -- Foreign key to users(id) for the B2B partner
    service_code VARCHAR(50) NOT NULL, -- e.g., 'WHATSAPP_API'
    status VARCHAR(20) NOT NULL DEFAULT 'inactive', -- 'active', 'inactive', 'cancelled'
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE (user_id, service_code)
);

CREATE TABLE b2b_service_fees (
    id SERIAL PRIMARY KEY,
    service_code VARCHAR(50) NOT NULL UNIQUE, -- e.g., 'WHATSAPP_API', 'SMS_TIER_1'
    description TEXT,
    price_usd NUMERIC(10, 4) NOT NULL,
    -- For tiered services like SMS, this defines the purchase amount range for the tier
    min_amount_usd NUMERIC(10, 2),
    max_amount_usd NUMERIC(10, 2),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);



-- Gestion des pompes physiques
CREATE TABLE fuel_pumps (
    id SERIAL PRIMARY KEY,
    station_id INTEGER REFERENCES fuel_stations(id),
    pump_number VARCHAR(20),
    status VARCHAR(20) DEFAULT 'idle', -- idle, busy, out_of_order
    last_heartbeat TIMESTAMP
);

-- Gestion des réservoirs (Stocks réels IoT)
CREATE TABLE fuel_tanks (
    id SERIAL PRIMARY KEY,
    station_id INTEGER REFERENCES fuel_stations(id),
    product_id INTEGER REFERENCES fuel_products(id),
    capacity NUMERIC(15, 2),
    current_volume NUMERIC(15, 2),
    last_reading TIMESTAMP DEFAULT NOW()
);

-- Jetons de distribution autonome
CREATE TABLE fuel_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    station_id INTEGER REFERENCES fuel_stations(id),
    product_id INTEGER REFERENCES fuel_products(id),
    token_code VARCHAR(12) UNIQUE,
    amount NUMERIC(15, 2),
    liters NUMERIC(15, 3),
    currency CHAR(3),
    status VARCHAR(20) DEFAULT 'valid', -- valid, used, expired, cancelled
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '24 hours')
);

-- Table des stations-service
CREATE TABLE fuel_stations (
    id SERIAL PRIMARY KEY,
    owner_user_id INTEGER REFERENCES users(id),
    name VARCHAR(255) NOT NULL,
    address TEXT,
    country_code CHAR(2) NOT NULL,
    province VARCHAR(100),
    base_currency CHAR(3) DEFAULT 'CDF', -- Devise dans laquelle la station reçoit ses fonds
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Table des produits (Essence, Gasoil, etc.)
CREATE TABLE fuel_products (
    id SERIAL PRIMARY KEY,
    station_id INTEGER REFERENCES fuel_stations(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    price_per_liter NUMERIC(15, 2) NOT NULL, -- Prix dans la devise de base de la station
    status VARCHAR(20) DEFAULT 'active',
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Table des transactions de carburant
CREATE TABLE fuel_transactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    station_id INTEGER REFERENCES fuel_stations(id),
    product_id INTEGER REFERENCES fuel_products(id),
    amount_fiat_sent NUMERIC(15, 2) NOT NULL, -- Ce que le client a payé
    currency_fiat_sent CHAR(3) NOT NULL,
    amount_local_received NUMERIC(15, 2) NOT NULL, -- Ce que la station a reçu
    liters NUMERIC(15, 3) NOT NULL,
    exchange_rate NUMERIC(15, 6),
    reference_code VARCHAR(50) UNIQUE,
    status VARCHAR(20) DEFAULT 'completed',
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE payment_links (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    amount DECIMAL(18,2),
    is_fixed BOOLEAN NOT NULL DEFAULT TRUE,
    currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    category VARCHAR(100) NOT NULL,
    image_url TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    visit_count INTEGER NOT NULL DEFAULT 0,
    collected_amount DECIMAL(18,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE payment_links
ADD CONSTRAINT fk_payment_links_user
FOREIGN KEY (user_id)
REFERENCES users(id);

-- Table des actions en attente (Autorisation Agent)
CREATE TABLE IF NOT EXISTS project_pending_actions (
    id SERIAL PRIMARY KEY,
    project_id INT REFERENCES jojo_ai_projects(id) ON DELETE CASCADE,
    action_type VARCHAR(20), -- 'create_file', 'update_file', 'create_folder'
    file_path VARCHAR(512),
    content TEXT,
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Mise à jour des projets pour le statut et la date
ALTER TABLE jojo_ai_projects ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';
ALTER TABLE jojo_ai_projects ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;

-- Table de Collaboration
CREATE TABLE IF NOT EXISTS project_collaborators (
    id SERIAL PRIMARY KEY,
    project_id INT REFERENCES jojo_ai_projects(id) ON DELETE CASCADE,
    user_id INT REFERENCES dev_portal_users(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'collaborator', -- 'admin', 'collaborator', 'viewer'
    joined_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(project_id, user_id)
);

-- Mise à jour de la table des collaborateurs pour gérer les invitations
CREATE TABLE IF NOT EXISTS project_collaborators (
    id SERIAL PRIMARY KEY,
    project_id INT REFERENCES jojo_ai_projects(id) ON DELETE CASCADE,
    user_id INT REFERENCES dev_portal_users(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'collaborator',
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'accepted', 'rejected'
    invited_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    accepted_at TIMESTAMPTZ,
    UNIQUE(project_id, user_id)
);

-- Index pour accélérer la recherche des invitations
CREATE INDEX IF NOT EXISTS idx_collab_user_status ON project_collaborators(user_id, status);



CREATE TABLE IF NOT EXISTS hardware_keys (
    id SERIAL PRIMARY KEY,
    key_reference VARCHAR(50) UNIQUE NOT NULL,
    owner_user_id INTEGER REFERENCES users(id) NOT NULL,
    issuer_partner_id INTEGER,
    issuer_fleet_wallet_id VARCHAR(20),
    issuing_bank_name VARCHAR(100),
    issuing_country_code VARCHAR(10),
    amount NUMERIC(15, 2) NOT NULL, -- Utilisé comme solde courant
    currency VARCHAR(10) NOT NULL,
    security_level VARCHAR(20) DEFAULT 'none',
    pin_hash VARCHAR(255),
    hsm_signature VARCHAR(255) UNIQUE NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    source_transaction_id INTEGER REFERENCES transactions(id),
    created_at TIMESTAMP DEFAULT NOW(),
    claimed_at TIMESTAMP,
    cancelled_at TIMESTAMP,
    claimed_by_user_id INTEGER REFERENCES users(id),
    linked_card_id TEXT -- Requis pour la liaison aux cartes Visa/Mastercard
);

CREATE TABLE IF NOT EXISTS chess_games (
    id SERIAL PRIMARY KEY,
    game_code VARCHAR(20) UNIQUE NOT NULL,
    player1_id INTEGER REFERENCES users(id) NOT NULL,
    player2_id INTEGER REFERENCES users(id),
    player1_color VARCHAR(10) NOT NULL, -- 'white' or 'black'
    bet_amount NUMERIC(15, 2) NOT NULL,
    currency VARCHAR(10) NOT NULL,
    status VARCHAR(20) DEFAULT 'waiting', -- 'waiting', 'active', 'completed', 'rejected', 'forfeited'
    fen TEXT, -- État final du plateau
    winner_id INTEGER REFERENCES users(id), -- NULL si match nul
    draw_proposed_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Index pour accélérer la recherche d'historique
CREATE INDEX IF NOT EXISTS idx_chess_player1 ON chess_games(player1_id);
CREATE INDEX IF NOT EXISTS idx_chess_player2 ON chess_games(player2_id);
CREATE INDEX IF NOT EXISTS idx_chess_status ON chess_games(status);


-- Table principale des produits (incluant les livres)
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    agent_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    boutique_id INTEGER REFERENCES boutiques(id) ON DELETE SET NULL,
    category_id VARCHAR(50), -- 'cat-livre' pour les ouvrages
    name VARCHAR(255) NOT NULL,
    description TEXT,
    -- Le champ details stocke : auteur, biographie, conclusion, type d'édition, 
    -- ainsi que les URLs sécurisées (pdfUrl, sourceUrl, audioUrl, authorImage)
    details JSONB, 
    images JSONB DEFAULT '[]'::jsonb, -- [Couverture Recto, Verso, Galerie]
    purchase_price NUMERIC(15, 2),
    selling_price NUMERIC(15, 2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'USD',
    weight NUMERIC(10, 2) DEFAULT 0,
    barcode VARCHAR(100) UNIQUE,
    stock INTEGER DEFAULT 0,
    is_public BOOLEAN DEFAULT false,
    shipping_rates JSONB DEFAULT '[]'::jsonb,
    promotional_packages JSONB DEFAULT '[]'::jsonb,
    variations JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Table des commentaires et avis produits
CREATE TABLE IF NOT EXISTS product_comments (
    id SERIAL PRIMARY KEY,
    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    author_name VARCHAR(255),
    text TEXT NOT NULL,
    parent_comment_id INTEGER REFERENCES product_comments(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Index pour la performance
CREATE INDEX IF NOT EXISTS idx_products_agent ON products(agent_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_comments_product ON product_comments(product_id);

ALTER TABLE products ADD COLUMN IF NOT EXISTS isbn10 VARCHAR(20);
ALTER TABLE products ADD COLUMN IF NOT EXISTS isbn13 VARCHAR(20);
