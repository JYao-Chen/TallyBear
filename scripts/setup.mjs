import {writeFileSync,existsSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
if(existsSync('.env')){console.error('.env already exists; it was not changed.');process.exit(1);}
const password=randomBytes(24).toString('hex');
writeFileSync('.env',`APP_ORIGIN=http://localhost:3016
APP_LANGUAGE=en
APP_CURRENCY=USD
POSTGRES_PASSWORD=${password}
DATABASE_URL=postgres://tallybear:${password}@127.0.0.1:5439/tallybear
ENCRYPTION_KEY=${randomBytes(32).toString('base64')}
ADMIN_USERNAME=admin
ADMIN_NAME=Admin
ADMIN_PASSWORD=${randomBytes(18).toString('base64url')}
RECEIPT_DIR=./data/receipts
`,{mode:0o600,flag:'wx'});
console.log('Created .env with unique credentials. Read ADMIN_PASSWORD in that file to sign in. Set APP_ORIGIN, APP_LANGUAGE and APP_CURRENCY before first startup.');
