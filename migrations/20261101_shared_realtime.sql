-- Run deliberately in Adminer on the application database, after the meeting compatibility migrations.
-- Additive: no user, money, message or participant data is deleted or fabricated.
BEGIN;
CREATE OR REPLACE FUNCTION cashpay_notify_insert() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    -- Match the existing application's JSON exactly; PostgreSQL coalesces duplicate NOTIFY
    -- events inside a transaction, and clients upsert by the authoritative message ID.
    PERFORM pg_notify(TG_ARGV[0], '{"id":' || to_json(NEW.id::text)::text || '}');
    RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS cashpay_message_realtime ON messages;
CREATE TRIGGER cashpay_message_realtime AFTER INSERT ON messages
    FOR EACH ROW EXECUTE FUNCTION cashpay_notify_insert('onchat_messages');
DROP TRIGGER IF EXISTS cashpay_group_message_realtime ON group_messages;
CREATE TRIGGER cashpay_group_message_realtime AFTER INSERT ON group_messages
    FOR EACH ROW EXECUTE FUNCTION cashpay_notify_insert('onchat_group_messages');
DROP TRIGGER IF EXISTS cashpay_notification_realtime ON notifications;
CREATE TRIGGER cashpay_notification_realtime AFTER INSERT ON notifications
    FOR EACH ROW EXECUTE FUNCTION cashpay_notify_insert('cashpay_notifications');
COMMIT;
