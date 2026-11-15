-- Structures already required by the loan engine. No balances or historical schedules are changed.
BEGIN;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS repayment_frequency VARCHAR(20) NOT NULL DEFAULT 'monthly', ADD COLUMN IF NOT EXISTS installment_count INTEGER, ADD COLUMN IF NOT EXISTS installment_amount NUMERIC(18,2);
CREATE TABLE IF NOT EXISTS loan_installments (
 id BIGSERIAL PRIMARY KEY, loan_id INTEGER NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
 installment_number INTEGER NOT NULL, due_date TIMESTAMPTZ NOT NULL, amount NUMERIC(18,2) NOT NULL,
 penalty_amount NUMERIC(18,2) NOT NULL DEFAULT 0, paid_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
 status VARCHAR(20) NOT NULL DEFAULT 'pending', penalty_applied_on DATE, last_penalty_date DATE,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(loan_id,installment_number)
);
ALTER TABLE loan_installments ADD COLUMN IF NOT EXISTS last_penalty_date DATE;
COMMIT;
