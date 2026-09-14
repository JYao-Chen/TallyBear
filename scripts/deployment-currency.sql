CREATE TABLE IF NOT EXISTS deployment_settings (
 id integer PRIMARY KEY CHECK(id=1), currency text NOT NULL CHECK(currency IN ('CNY','USD','EUR','GBP'))
);
