import { db } from './db';
import { deployment } from '@/lib/deployment';
let checked: ReturnType<typeof verifyCurrency> | undefined;
export function checkDeploymentCurrency() {
  return (checked ??= verifyCurrency().catch(error => {
    checked = undefined;
    throw error;
  }));
}
async function verifyCurrency() {
  const config = deployment();
  const row = (await db.query('SELECT currency FROM deployment_settings WHERE id=1')).rows[0];
  if (!row || row.currency !== config.currency)
    throw new Error(
      `APP_CURRENCY=${config.currency} does not match database currency ${row?.currency || '(unset)'}. Currency changes require an explicit data conversion or a new database.`,
    );
  return config;
}
