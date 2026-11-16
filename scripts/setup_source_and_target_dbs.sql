-- ==============================================================================
-- DATABASE 1: SOURCE ERP (Legacy Monolith Format - Complex & Raw)
-- Database Name: erp_source_db
-- ==============================================================================

CREATE DATABASE IF NOT EXISTS erp_source_db;
USE erp_source_db;

-- Table 1: Raw Customers (Contains combined name, epoch timestamp, integer cents, raw delimited address)
DROP TABLE IF EXISTS legacy_order_lines;
DROP TABLE IF EXISTS legacy_customer_payments;
DROP TABLE IF EXISTS legacy_support_tickets;
DROP TABLE IF EXISTS legacy_sales_orders;
DROP TABLE IF EXISTS legacy_warehouse_stock;
DROP TABLE IF EXISTS legacy_catalog_items;
DROP TABLE IF EXISTS legacy_accounts;
DROP TABLE IF EXISTS legacy_customers;

CREATE TABLE legacy_customers (
    cust_id VARCHAR(32) PRIMARY KEY,
    full_name VARCHAR(150) NOT NULL,
    email_raw VARCHAR(150) NOT NULL,
    phone_raw VARCHAR(50),
    shipping_address_raw TEXT,
    billing_address_raw TEXT,
    credit_limit_cents BIGINT NOT NULL DEFAULT 0,
    status_code TINYINT NOT NULL DEFAULT 1 COMMENT '1=ACTIVE, 2=SUSPENDED, 3=TERMINATED',
    registered_epoch BIGINT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table 2: Financial Accounts
CREATE TABLE legacy_accounts (
    account_num VARCHAR(32) PRIMARY KEY,
    cust_id VARCHAR(32) NOT NULL,
    account_type VARCHAR(20) NOT NULL,
    balance_cents BIGINT NOT NULL DEFAULT 0,
    currency_iso CHAR(3) NOT NULL DEFAULT 'USD',
    opened_date_int INT NOT NULL COMMENT 'YYYYMMDD integer',
    CONSTRAINT fk_acc_cust FOREIGN KEY (cust_id) REFERENCES legacy_customers (cust_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table 3: Product Catalog (Hierarchy string, cents prices, JSON attributes)
CREATE TABLE legacy_catalog_items (
    item_sku VARCHAR(50) PRIMARY KEY,
    item_title VARCHAR(200) NOT NULL,
    category_hierarchy VARCHAR(200) NOT NULL COMMENT 'e.g. Electronics > Audio > Headphones',
    list_price_cents INT NOT NULL,
    wholesale_cost_cents INT NOT NULL,
    attributes_json TEXT COMMENT '{"color":"black","wireless":true}',
    discontinued_flag CHAR(1) NOT NULL DEFAULT 'N'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table 4: Warehouse Stock & Inventory
CREATE TABLE legacy_warehouse_stock (
    stock_id INT AUTO_INCREMENT PRIMARY KEY,
    warehouse_code VARCHAR(20) NOT NULL,
    item_sku VARCHAR(50) NOT NULL,
    qty_in_stock INT NOT NULL DEFAULT 0,
    qty_allocated INT NOT NULL DEFAULT 0,
    reorder_threshold INT NOT NULL DEFAULT 10,
    aisle_location VARCHAR(30),
    CONSTRAINT fk_stock_item FOREIGN KEY (item_sku) REFERENCES legacy_catalog_items (item_sku)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table 5: Sales Orders (Numeric status codes, epoch timestamp, cent amounts)
CREATE TABLE legacy_sales_orders (
    order_num VARCHAR(32) PRIMARY KEY,
    cust_id VARCHAR(32) NOT NULL,
    order_epoch BIGINT NOT NULL,
    order_status_id TINYINT NOT NULL COMMENT '10=DRAFT, 20=CONFIRMED, 30=PROCESSING, 40=SHIPPED, 50=DELIVERED, 90=CANCELLED',
    subtotal_cents BIGINT NOT NULL DEFAULT 0,
    tax_cents BIGINT NOT NULL DEFAULT 0,
    freight_cents BIGINT NOT NULL DEFAULT 0,
    total_cents BIGINT NOT NULL DEFAULT 0,
    shipping_method_code VARCHAR(50) NOT NULL,
    CONSTRAINT fk_order_cust FOREIGN KEY (cust_id) REFERENCES legacy_customers (cust_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table 6: Sales Order Line Items
CREATE TABLE legacy_order_lines (
    line_id VARCHAR(64) PRIMARY KEY,
    order_num VARCHAR(32) NOT NULL,
    item_sku VARCHAR(50) NOT NULL,
    quantity_ordered INT NOT NULL DEFAULT 1,
    unit_price_cents INT NOT NULL,
    discount_pct DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    line_total_cents BIGINT NOT NULL,
    CONSTRAINT fk_line_order FOREIGN KEY (order_num) REFERENCES legacy_sales_orders (order_num),
    CONSTRAINT fk_line_item FOREIGN KEY (item_sku) REFERENCES legacy_catalog_items (item_sku)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table 7: Customer Payments (Composite payment codes, integer settlement flags)
CREATE TABLE legacy_customer_payments (
    payment_ref VARCHAR(50) PRIMARY KEY,
    order_num VARCHAR(32) NOT NULL,
    payment_method_code VARCHAR(20) NOT NULL COMMENT 'CC_VISA, CC_MC, ACH_DEBIT, WIRE',
    amount_cents BIGINT NOT NULL,
    payment_epoch BIGINT NOT NULL,
    gateway_txn_id VARCHAR(100),
    settlement_status TINYINT NOT NULL DEFAULT 0 COMMENT '1=SETTLED, 0=PENDING, -1=FAILED',
    CONSTRAINT fk_pay_order FOREIGN KEY (order_num) REFERENCES legacy_sales_orders (order_num)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table 8: Support Tickets & Incidents
CREATE TABLE legacy_support_tickets (
    ticket_ref VARCHAR(32) PRIMARY KEY,
    cust_id VARCHAR(32) NOT NULL,
    related_order_num VARCHAR(32),
    category_code VARCHAR(30) NOT NULL COMMENT 'DEFECT, BILLING, LOGISTICS',
    urgency_code TINYINT NOT NULL DEFAULT 2 COMMENT '1=LOW, 2=MED, 3=HIGH, 4=CRITICAL',
    status_name VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    opened_epoch BIGINT NOT NULL,
    resolved_epoch BIGINT,
    CONSTRAINT fk_tick_cust FOREIGN KEY (cust_id) REFERENCES legacy_customers (cust_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ── Seed Data for Source ERP ─────────────────────────────────────────────────
INSERT INTO legacy_customers VALUES 
('CUST-1001', 'Hamilton, Alexander', 'alex.hamilton@treasury.gov', '+1 (212) 555-0101', '57 Maiden Ln | Apt 4B | New York | NY | 10038 | USA', '57 Maiden Ln | Apt 4B | New York | NY | 10038 | USA', 5000000, 1, 1704067200),
('CUST-1002', 'Lovelace, Ada', 'ada.lovelace@analytics.io', '+44 20 7946 0991', '12 St James Square | Floor 3 | London | Greater London | SW1Y 4LB | GBR', '12 St James Square | Floor 3 | London | Greater London | SW1Y 4LB | GBR', 8500000, 1, 1706745600),
('CUST-1003', 'Turing, Alan', 'alan.turing@bletchley.ac.uk', '+44 1908 640134', 'Church Green | Manor House | Bletchley | Milton Keynes | MK3 6EB | GBR', 'Church Green | Manor House | Bletchley | Milton Keynes | MK3 6EB | GBR', 3200000, 2, 1709251200),
('CUST-1004', 'Hopper, Grace', 'grace.hopper@navy.mil', '+1 (703) 555-0199', '1400 Defense Pentagon | Rm 3E120 | Arlington | VA | 20301 | USA', '1400 Defense Pentagon | Rm 3E120 | Arlington | VA | 20301 | USA', 12000000, 1, 1711929600),
('CUST-1005', 'Curie, Marie', 'marie.curie@radium.org', '+33 1 42 34 56 78', '11 Rue Pierre et Marie Curie | Bâtiment B | Paris | Île-de-France | 75005 | FRA', '11 Rue Pierre et Marie Curie | Bâtiment B | Paris | Île-de-France | 75005 | FRA', 4000000, 3, 1714521600);

INSERT INTO legacy_accounts VALUES
('ACC-US-901', 'CUST-1001', 'COMMERCIAL', 4250000, 'USD', 20240101),
('ACC-UK-902', 'CUST-1002', 'ENTERPRISE', 11200000, 'USD', 20240201),
('ACC-UK-903', 'CUST-1003', 'STANDARD', 315000, 'USD', 20240301),
('ACC-US-904', 'CUST-1004', 'GOVERNMENT', 19800000, 'USD', 20240401),
('ACC-EU-905', 'CUST-1005', 'RESEARCH', 540000, 'EUR', 20240501);

INSERT INTO legacy_catalog_items VALUES
('SKU-HD-100', 'Quantum Noise-Cancelling Headphones', 'Electronics > Audio > Headphones', 29999, 14500, '{"color":"matte-black","wireless":true,"anc":true,"battery_hours":40}', 'N'),
('SKU-KB-200', 'Titan Mechanical Ergonomic Keyboard', 'Electronics > Computer Accessories > Keyboards', 17950, 7800, '{"switch":"Cherry-MX-Brown","rgb":true,"wireless":false}', 'N'),
('SKU-MN-300', 'Curved UltraWide 38-inch Monitor', 'Electronics > Displays > Monitors', 89900, 52000, '{"panel":"IPS","refresh_rate_hz":144,"resolution":"3840x1600"}', 'N'),
('SKU-DK-400', 'Motorized Bamboo Standing Desk', 'Office Furniture > Desks > Standing Desks', 64900, 31000, '{"motor_count":2,"width_cm":160,"memory_presets":4}', 'N'),
('SKU-CH-500', 'ErgoPro Mesh Executive Chair', 'Office Furniture > Seating > Task Chairs', 44900, 21000, '{"lumbar_support":true,"mesh":"breathable-elastomer"}', 'N');

INSERT INTO legacy_warehouse_stock VALUES
(NULL, 'WH-US-EAST', 'SKU-HD-100', 450, 45, 50, 'Aisle-04-Rack-12'),
(NULL, 'WH-US-WEST', 'SKU-KB-200', 820, 110, 80, 'Aisle-02-Rack-05'),
(NULL, 'WH-EU-CENTRAL', 'SKU-MN-300', 115, 22, 20, 'Aisle-09-Rack-01'),
(NULL, 'WH-US-EAST', 'SKU-DK-400', 60, 14, 15, 'Aisle-14-Pallet-03'),
(NULL, 'WH-EU-CENTRAL', 'SKU-CH-500', 140, 30, 25, 'Aisle-12-Pallet-08');

INSERT INTO legacy_sales_orders VALUES
('ORD-2024-8801', 'CUST-1001', 1705320000, 50, 119899, 9592, 2500, 131991, 'FEDEX_PRIORITY'),
('ORD-2024-8802', 'CUST-1002', 1707998400, 50, 197750, 15820, 3500, 217070, 'DHL_EXPRESS'),
('ORD-2024-8803', 'CUST-1003', 1710504000, 40, 29999, 2400, 1500, 33899, 'ROYAL_MAIL_TRACKED'),
('ORD-2024-8804', 'CUST-1004', 1713096000, 30, 244700, 19576, 5000, 269276, 'USPS_PRIORITY'),
('ORD-2024-8805', 'CUST-1005', 1715688000, 90, 89900, 7192, 4000, 101092, 'COLISSIMO_INTERNATIONAL');

INSERT INTO legacy_order_lines VALUES
('LN-8801-01', 'ORD-2024-8801', 'SKU-HD-100', 2, 29999, 0.00, 59998),
('LN-8801-02', 'ORD-2024-8801', 'SKU-DK-400', 1, 64900, 8.00, 59901),
('LN-8802-01', 'ORD-2024-8802', 'SKU-MN-300', 2, 89900, 5.00, 170810),
('LN-8802-02', 'ORD-2024-8802', 'SKU-KB-200', 1, 17950, 0.00, 17950),
('LN-8803-01', 'ORD-2024-8803', 'SKU-HD-100', 1, 29999, 0.00, 29999),
('LN-8804-01', 'ORD-2024-8804', 'SKU-DK-400', 2, 64900, 0.00, 129800),
('LN-8804-02', 'ORD-2024-8804', 'SKU-CH-500', 2, 44900, 0.00, 89800),
('LN-8805-01', 'ORD-2024-8805', 'SKU-MN-300', 1, 89900, 0.00, 89900);

INSERT INTO legacy_customer_payments VALUES
('PAY-TX-701', 'ORD-2024-8801', 'CC_VISA', 131991, 1705320500, 'ch_visa_380299104', 1),
('PAY-TX-702', 'ORD-2024-8802', 'WIRE', 217070, 1708000000, 'wire_uk_swift_88301', 1),
('PAY-TX-703', 'ORD-2024-8803', 'CC_MC', 33899, 1710504600, 'ch_mc_490192801', 1),
('PAY-TX-704', 'ORD-2024-8804', 'ACH_DEBIT', 269276, 1713096500, 'ach_sec_gov_11094', 1),
('PAY-TX-705', 'ORD-2024-8805', 'CC_VISA', 101092, 1715688500, 'ch_visa_failed_auth', -1);

INSERT INTO legacy_support_tickets VALUES
('TCK-2024-01', 'CUST-1001', 'ORD-2024-8801', 'SHIPPING_DELAY', 2, 'RESOLVED', 1705400000, 1705486400),
('TCK-2024-02', 'CUST-1003', 'ORD-2024-8803', 'DEFECT', 3, 'OPEN', 1710600000, NULL),
('TCK-2024-03', 'CUST-1004', 'ORD-2024-8804', 'BILLING', 1, 'RESOLVED', 1713200000, 1713220000),
('TCK-2024-04', 'CUST-1005', 'ORD-2024-8805', 'PAYMENT_ISSUE', 4, 'RESOLVED', 1715700000, 1715710000);


-- ==============================================================================
-- DATABASE 2: DESTINATION MODERN DATA WAREHOUSE (3NF & Star Schema)
-- Database Name: analytics_target_db
-- ==============================================================================

CREATE DATABASE IF NOT EXISTS analytics_target_db;
USE analytics_target_db;

DROP TABLE IF EXISTS fct_support_cases;
DROP TABLE IF EXISTS fct_payments;
DROP TABLE IF EXISTS fct_order_line_items;
DROP TABLE IF EXISTS fct_orders;
DROP TABLE IF EXISTS dim_warehouses;
DROP TABLE IF EXISTS dim_products;
DROP TABLE IF EXISTS dim_customer_addresses;
DROP TABLE IF EXISTS dim_customers;

-- Dimension 1: Normalized Customers (Split names, ISO datetimes, clean status string)
CREATE TABLE dim_customers (
    customer_key INT AUTO_INCREMENT PRIMARY KEY,
    customer_natural_id VARCHAR(32) NOT NULL UNIQUE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    clean_email VARCHAR(150) NOT NULL,
    formatted_phone VARCHAR(50),
    customer_status VARCHAR(20) NOT NULL,
    registration_date DATETIME NOT NULL,
    credit_limit_usd DECIMAL(12,2) NOT NULL DEFAULT 0.00
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Dimension 2: Normalized Addresses (Extracted from raw pipe-delimited string)
CREATE TABLE dim_customer_addresses (
    address_key INT AUTO_INCREMENT PRIMARY KEY,
    customer_natural_id VARCHAR(32) NOT NULL,
    address_type ENUM('SHIPPING', 'BILLING') NOT NULL,
    street_line_1 VARCHAR(150) NOT NULL,
    unit_or_apt VARCHAR(50),
    city VARCHAR(100) NOT NULL,
    state_or_province VARCHAR(50) NOT NULL,
    postal_code VARCHAR(20) NOT NULL,
    country_code CHAR(3) NOT NULL,
    is_primary BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT fk_dim_cust_addr FOREIGN KEY (customer_natural_id) REFERENCES dim_customers (customer_natural_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Dimension 3: Normalized Products (Parsed categories, dollar decimals, extracted JSON flags)
CREATE TABLE dim_products (
    product_key INT AUTO_INCREMENT PRIMARY KEY,
    sku VARCHAR(50) NOT NULL UNIQUE,
    product_name VARCHAR(200) NOT NULL,
    primary_category VARCHAR(100) NOT NULL,
    sub_category VARCHAR(100) NOT NULL,
    list_price_usd DECIMAL(10,2) NOT NULL,
    unit_cost_usd DECIMAL(10,2) NOT NULL,
    is_wireless BOOLEAN NOT NULL DEFAULT FALSE,
    color VARCHAR(50),
    is_active BOOLEAN NOT NULL DEFAULT TRUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Dimension 4: Warehouses & Inventory
CREATE TABLE dim_warehouses (
    warehouse_key INT AUTO_INCREMENT PRIMARY KEY,
    warehouse_code VARCHAR(20) NOT NULL,
    sku VARCHAR(50) NOT NULL,
    location_aisle VARCHAR(30),
    stock_on_hand INT NOT NULL DEFAULT 0,
    stock_reserved INT NOT NULL DEFAULT 0,
    stock_available INT NOT NULL DEFAULT 0,
    needs_reorder BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT fk_dim_wh_prod FOREIGN KEY (sku) REFERENCES dim_products (sku)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Fact 1: Orders Fact (UTC Timestamp, dollar amounts, status enum string)
CREATE TABLE fct_orders (
    order_key INT AUTO_INCREMENT PRIMARY KEY,
    order_natural_id VARCHAR(32) NOT NULL UNIQUE,
    customer_natural_id VARCHAR(32) NOT NULL,
    order_datetime_utc DATETIME NOT NULL,
    order_status VARCHAR(30) NOT NULL,
    subtotal_amount_usd DECIMAL(12,2) NOT NULL,
    tax_amount_usd DECIMAL(10,2) NOT NULL,
    freight_amount_usd DECIMAL(10,2) NOT NULL,
    total_amount_usd DECIMAL(12,2) NOT NULL,
    carrier_service VARCHAR(50) NOT NULL,
    CONSTRAINT fk_fct_order_cust FOREIGN KEY (customer_natural_id) REFERENCES dim_customers (customer_natural_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Fact 2: Order Line Items Fact (Computed unit prices, discount rates, line totals)
CREATE TABLE fct_order_line_items (
    line_item_key INT AUTO_INCREMENT PRIMARY KEY,
    order_natural_id VARCHAR(32) NOT NULL,
    sku VARCHAR(50) NOT NULL,
    ordered_units INT NOT NULL,
    unit_price_usd DECIMAL(10,2) NOT NULL,
    discount_percentage DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    extended_price_usd DECIMAL(12,2) NOT NULL,
    CONSTRAINT fk_fct_line_order FOREIGN KEY (order_natural_id) REFERENCES fct_orders (order_natural_id),
    CONSTRAINT fk_fct_line_prod FOREIGN KEY (sku) REFERENCES dim_products (sku)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Fact 3: Payments Fact (Gateway details, dollar decimals, status boolean)
CREATE TABLE fct_payments (
    payment_key INT AUTO_INCREMENT PRIMARY KEY,
    payment_transaction_id VARCHAR(50) NOT NULL UNIQUE,
    order_natural_id VARCHAR(32) NOT NULL,
    payment_channel VARCHAR(30) NOT NULL,
    card_brand VARCHAR(20),
    paid_amount_usd DECIMAL(12,2) NOT NULL,
    payment_timestamp_utc DATETIME NOT NULL,
    is_cleared BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT fk_fct_pay_order FOREIGN KEY (order_natural_id) REFERENCES fct_orders (order_natural_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Fact 4: Support Cases Fact (SLA tracking, resolution hours)
CREATE TABLE fct_support_cases (
    case_key INT AUTO_INCREMENT PRIMARY KEY,
    case_reference_number VARCHAR(32) NOT NULL UNIQUE,
    customer_natural_id VARCHAR(32) NOT NULL,
    associated_order_id VARCHAR(32),
    issue_category VARCHAR(50) NOT NULL,
    priority_tier ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') NOT NULL,
    resolution_status VARCHAR(30) NOT NULL,
    case_opened_at DATETIME NOT NULL,
    case_resolved_at DATETIME,
    time_to_resolve_hours DECIMAL(8,2),
    CONSTRAINT fk_fct_case_cust FOREIGN KEY (customer_natural_id) REFERENCES dim_customers (customer_natural_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
