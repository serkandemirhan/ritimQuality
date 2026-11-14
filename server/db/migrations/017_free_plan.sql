-- Enum addition must commit before 018 uses the new value. Existing subscriptions are unchanged.
ALTER TYPE subscription_plan ADD VALUE IF NOT EXISTS 'free';
