ALTER TABLE bill_schedules DROP CONSTRAINT IF EXISTS bill_schedules_frequency_check;
ALTER TABLE bill_schedules ADD CONSTRAINT bill_schedules_frequency_check CHECK(frequency IN ('daily','weekly','monthly','yearly'));
ALTER TABLE bill_schedules DROP CONSTRAINT IF EXISTS bill_schedules_interval_months_check;
ALTER TABLE bill_schedules ADD COLUMN IF NOT EXISTS interval_count integer;
UPDATE bill_schedules SET frequency='monthly' WHERE interval_count IS NULL AND frequency='yearly' AND interval_months>0 AND interval_months%12<>0;
UPDATE bill_schedules SET interval_count=CASE WHEN frequency='weekly' THEN 1 WHEN frequency='yearly' THEN greatest(interval_months/12,1) ELSE greatest(interval_months,1) END WHERE interval_count IS NULL;
ALTER TABLE bill_schedules ALTER COLUMN interval_count SET DEFAULT 1;
ALTER TABLE bill_schedules ALTER COLUMN interval_count SET NOT NULL;
ALTER TABLE expense_allocations DROP CONSTRAINT IF EXISTS expense_allocations_months_check;
ALTER TABLE expense_allocations ADD COLUMN IF NOT EXISTS period_unit text NOT NULL DEFAULT 'month';
ALTER TABLE expense_allocations ADD COLUMN IF NOT EXISTS period_count integer;
ALTER TABLE expense_allocations ADD COLUMN IF NOT EXISTS start_date date;
UPDATE expense_allocations SET period_count=months,start_date=start_month WHERE period_count IS NULL;

ALTER TABLE bill_schedules ADD CONSTRAINT bill_schedules_interval_months_check CHECK(interval_months>=0);
ALTER TABLE expense_allocations ADD CONSTRAINT expense_allocations_months_check CHECK(months>=1);
