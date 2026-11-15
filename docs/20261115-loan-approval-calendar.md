# Loan calendars start at approval, including the clock time

Pending requests expose request_date, with approval/start/end null and no contractual schedule. Rejected/cancelled requests also expose no active calendar. The old history fallback from approval_date to request_date and the fabricated request-plus-duration expiry have been removed. Approved loan dates and last expiry come from the recorded approval timestamp and actual stored installments. API timestamps retain the full ISO instant rather than being truncated to YYYY-MM-DD.

Approval still locks a pending request and performs disbursement/schedule creation atomically. It now writes approval_date with PostgreSQL clock_timestamp() after acquiring the lock, RETURNING that exact value to generate every installment. No second JavaScript current-time reading starts a slightly different calendar. Missing approval timestamps abort before disbursement. Weekly schedules preserve the approval weekday/time; monthly schedules retain the clock and use existing month-end clamping. Failed/repeated approvals do not create a second schedule.

The seven-day collection grace period compares full due timestamps to NOW() minus seven days; it no longer becomes eligible early at midnight by casting due dates to dates. Reminder day windows are unchanged. Existing approved schedules/funds were not recalculated or modified by deployment.

Web history distinguishes request dates from approval dates. Android 12.8/code128 displays pending approval explicitly, and approved dates include weekday, full date, clock time and timezone. Phone-local timezone conversion represents the same ISO instant; legacy date-only values receive no invented hour.

Validation: isolated actual approval action tests for pending histories, DB timestamp anchoring, weekly Monday installments with milliseconds, Jan31 monthly clamping, duplicate/failed approvals and missing timestamps. Android pure date tests cover weekdays, hours, timezone/day rollover and missing/legacy dates. No live approval or production database mutation was performed.
