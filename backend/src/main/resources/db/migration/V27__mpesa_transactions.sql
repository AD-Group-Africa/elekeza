-- V27: Create mpesa_transactions table
CREATE TABLE IF NOT EXISTS mpesa_transactions (
    id BIGSERIAL PRIMARY KEY,
    merchant_request_id VARCHAR(255),
    checkout_request_id VARCHAR(255),
    phone_number VARCHAR(20) NOT NULL,
    amount DOUBLE PRECISION NOT NULL,
    reference VARCHAR(255),
    description VARCHAR(500),
    status VARCHAR(50) DEFAULT 'PENDING',
    result_code INTEGER,
    result_desc VARCHAR(500),
    mpesa_receipt_number VARCHAR(50),
    transaction_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
