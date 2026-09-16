CREATE TABLE IF NOT EXISTS family_movement_books(movement_id uuid NOT NULL REFERENCES family_movements(id) ON DELETE CASCADE,user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,book_id uuid NOT NULL REFERENCES books(id) ON DELETE CASCADE,PRIMARY KEY(movement_id,user_id));
CREATE INDEX IF NOT EXISTS family_movement_books_book ON family_movement_books(book_id,user_id);
CREATE TABLE IF NOT EXISTS family_book_preferences(user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,book_id uuid REFERENCES books(id) ON DELETE CASCADE);
