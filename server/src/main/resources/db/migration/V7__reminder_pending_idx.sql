-- The periodic job reads the pending reminders that are due (additions only).
create index reminder_pending_idx on reminder (due_at) where result = 'pending';
