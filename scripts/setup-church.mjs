import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { readFile, writeFile } from 'node:fs/promises';

const io = createInterface({ input, output });
const configPath = new URL('../src/site.json', import.meta.url);
const wranglerPath = new URL('../wrangler.jsonc', import.meta.url);
const packagePath = new URL('../package.json', import.meta.url);
const site = JSON.parse(await readFile(configPath, 'utf8'));
const wrangler = JSON.parse(await readFile(wranglerPath, 'utf8'));
const appPackage = JSON.parse(await readFile(packagePath, 'utf8'));

async function ask(label, current) {
  const answer = (await io.question(`${label} [${current}]: `)).trim();
  return answer || current;
}

try {
  site.id = await ask('Church slug (lowercase, hyphenated)', site.id);
  site.name.af = await ask('Church name in Afrikaans', site.name.af);
  site.name.en = await ask('Church name in English', site.name.en);
  site.url = await ask('Public site URL', site.url);
  site.timezone = await ask('Time zone', site.timezone);
  site.theme.primary = await ask('Primary color (#RRGGBB)', site.theme.primary);
  site.theme.accent = await ask('Accent color (#RRGGBB)', site.theme.accent);

  if (site.id.length > 55 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(site.id)) throw new Error('Church slug must use lowercase letters, digits, and hyphens, with at most 55 characters.');
  if (!/^#[0-9a-f]{6}$/i.test(site.theme.primary) || !/^#[0-9a-f]{6}$/i.test(site.theme.accent)) throw new Error('Colors must use #RRGGBB format.');
  const siteUrl = new URL(site.url);
  if (siteUrl.protocol !== 'https:' || siteUrl.pathname !== '/' || siteUrl.search || siteUrl.hash) {
    throw new Error('Public site URL must be an https origin without a path or query.');
  }
  const hostname = siteUrl.hostname;
  if (hostname === 'example.invalid') throw new Error('Set a real site URL before configuring deployment.');

  wrangler.name = site.id;
  wrangler.r2_buckets[0].bucket_name = `${site.id}-cms`;
  wrangler.routes = [{ pattern: hostname, custom_domain: true }];
  appPackage.name = `sda-${site.id}-website`;
  await writeFile(configPath, `${JSON.stringify(site, null, 2)}\n`);
  await writeFile(wranglerPath, `${JSON.stringify(wrangler, null, 2)}\n`);
  await writeFile(packagePath, `${JSON.stringify(appPackage, null, 2)}\n`);
  output.write('\nConfiguration saved. Create the R2 bucket and configure Cloudflare Access before deploying.\n');
} finally {
  io.close();
}
