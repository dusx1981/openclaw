-- Products table with unified schema
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    platform VARCHAR(50) NOT NULL,
    platform_id VARCHAR(255) NOT NULL,
    title VARCHAR(1000) NOT NULL,
    main_image TEXT,
    images JSONB,
    source_url TEXT NOT NULL,
    price DECIMAL(12, 2) NOT NULL,
    original_price DECIMAL(12, 2),
    currency VARCHAR(10) NOT NULL DEFAULT 'CNY',
    sales INTEGER NOT NULL DEFAULT 0,
    sales_unit VARCHAR(50),
    sales_period VARCHAR(20) NOT NULL DEFAULT 'month',
    rating DECIMAL(3, 2),
    reviews_count INTEGER,
    shop_id VARCHAR(255),
    shop_name VARCHAR(500),
    shop_url TEXT,
    category_id VARCHAR(255),
    category_name VARCHAR(500),
    category_path JSONB,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    priority VARCHAR(5) NOT NULL DEFAULT 'P1',
    is_trending BOOLEAN NOT NULL DEFAULT FALSE,
    merchant_id VARCHAR(255),
    tags JSONB,
    extra_data JSONB,
    first_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    price_updated_at TIMESTAMP WITH TIME ZONE,
    sales_updated_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Unique constraint on (platform, platform_id)
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_platform_id ON products(platform, platform_id);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_products_platform ON products(platform);
CREATE INDEX IF NOT EXISTS idx_products_merchant_id ON products(merchant_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_priority ON products(priority);
CREATE INDEX IF NOT EXISTS idx_products_price ON products(price);
CREATE INDEX IF NOT EXISTS idx_products_sales ON products(sales);
CREATE INDEX IF NOT EXISTS idx_products_is_trending ON products(is_trending);
CREATE INDEX IF NOT EXISTS idx_products_last_seen_at ON products(last_seen_at);

-- GIN indexes for JSONB fields
CREATE INDEX IF NOT EXISTS idx_products_extra_data ON products USING GIN(extra_data);
CREATE INDEX IF NOT EXISTS idx_products_tags ON products USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_products_category_path ON products USING GIN(category_path);

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_products_updated_at 
    BEFORE UPDATE ON products 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Price history table (for future phases)
CREATE TABLE IF NOT EXISTS product_price_history (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    price DECIMAL(12, 2) NOT NULL,
    original_price DECIMAL(12, 2),
    currency VARCHAR(10) NOT NULL,
    recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_price_history_product_id ON product_price_history(product_id);
CREATE INDEX IF NOT EXISTS idx_price_history_recorded_at ON product_price_history(recorded_at);

-- Sales history table (for future phases)
CREATE TABLE IF NOT EXISTS product_sales_history (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    sales INTEGER NOT NULL,
    sales_unit VARCHAR(50),
    sales_period VARCHAR(20) NOT NULL,
    recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_history_product_id ON product_sales_history(product_id);
CREATE INDEX IF NOT EXISTS idx_sales_history_recorded_at ON product_sales_history(recorded_at);

-- Data sources configuration table
CREATE TABLE IF NOT EXISTS data_sources (
    id SERIAL PRIMARY KEY,
    platform VARCHAR(50) NOT NULL,
    source_id VARCHAR(100) NOT NULL UNIQUE,
    source_type VARCHAR(50) NOT NULL,
    priority INTEGER NOT NULL DEFAULT 1,
    cost_per_call DECIMAL(8, 4) NOT NULL DEFAULT 0,
    daily_quota INTEGER NOT NULL DEFAULT 100,
    is_available BOOLEAN NOT NULL DEFAULT TRUE,
    config JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_data_sources_platform ON data_sources(platform);
CREATE INDEX IF NOT EXISTS idx_data_sources_source_id ON data_sources(source_id);

-- Insert default data sources
INSERT INTO data_sources (platform, source_id, source_type, priority, cost_per_call, daily_quota) VALUES
    ('taobao', 'taobao_official_api', 'official_api', 1, 0, 100),
    ('taobao', 'taobao_jushuta', 'third_party_api', 2, 0.01, 1000),
    ('amazon', 'amazon_sp_api', 'official_api', 1, 0, 1000),
    ('amazon', 'amazon_product_api_skill', 'skill_crawler', 2, 0.02, 500),
    ('douyin', 'douyin_chanmama', 'third_party_api', 1, 0.02, 500),
    ('douyin', 'douyin_hot_trend', 'skill_crawler', 2, 0.01, 200),
    ('1688', '1688_official_api', 'official_api', 1, 0, 500),
    ('1688', '1688_jushuta', 'third_party_api', 2, 0.01, 1000),
    ('shopee', 'shopee_official_api', 'official_api', 1, 0, 500)
ON CONFLICT (source_id) DO NOTHING;