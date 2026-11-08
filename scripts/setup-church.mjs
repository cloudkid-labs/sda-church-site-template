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
  const location = site.location ?? { address: { af: '', en: '' }, lat: '', lng: '', directionsUrl: '', appleMapsUrl: '' };
  location.address = location.address && typeof location.address === 'object' ? location.address : { af: location.address ?? '', en: location.address ?? '' };
  location.address.af = await ask('Church address for the map (Afrikaans)', location.address.af);
  location.address.en = await ask('Church address for the map (English)', location.address.en);
  const lat = await ask('Map latitude', location.lat);
  const lng = await ask('Map longitude', location.lng);
  location.directionsUrl = await ask('Google Maps directions URL', location.directionsUrl);
  location.appleMapsUrl = await ask('Apple Maps URL (optional)', location.appleMapsUrl ?? '');
  site.location = {
    address: location.address,
    lat: Number(lat),
    lng: Number(lng),
    directionsUrl: location.directionsUrl,
    ...(location.appleMapsUrl ? { appleMapsUrl: location.appleMapsUrl } : {}),
    markerUrl: location.markerUrl ?? '/map-marker.svg',
  };
  wrangler.vars.CF_ACCESS_TEAM_DOMAIN = await ask('Cloudflare Access team domain', wrangler.vars.CF_ACCESS_TEAM_DOMAIN);
  wrangler.vars.CF_ACCESS_AUD = await ask('Cloudflare Access application AUD tag', wrangler.vars.CF_ACCESS_AUD);

  if (site.id.length > 55 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(site.id)) throw new Error('Church slug must use lowercase letters, digits, and hyphens, with at most 55 characters.');
  if (!/^#[0-9a-f]{6}$/i.test(site.theme.primary) || !/^#[0-9a-f]{6}$/i.test(site.theme.accent)) throw new Error('Colors must use #RRGGBB format.');
  if (!Number.isFinite(site.location.lat) || site.location.lat < -90 || site.location.lat > 90) throw new Error('Map latitude must be between -90 and 90.');
  if (!Number.isFinite(site.location.lng) || site.location.lng < -180 || site.location.lng > 180) throw new Error('Map longitude must be between -180 and 180.');
  if (!site.location.address.af.trim() || !site.location.address.en.trim()) throw new Error('Provide the church address in Afrikaans and English.');
  for (const url of [site.location.directionsUrl, site.location.appleMapsUrl].filter(Boolean)) {
    if (!/^https:\/\//.test(url)) throw new Error('Map links must use https.');
  }
  if (!site.location.directionsUrl) throw new Error('Provide a Google Maps directions URL.');
  const siteUrl = new URL(site.url);
  if (siteUrl.protocol !== 'https:' || siteUrl.pathname !== '/' || siteUrl.search || siteUrl.hash) {
    throw new Error('Public site URL must be an https origin without a path or query.');
  }
  const hostname = siteUrl.hostname;
  if (hostname === 'example.invalid') throw new Error('Set a real site URL before configuring deployment.');
  if (!/^[a-z0-9.-]+$/i.test(wrangler.vars.CF_ACCESS_TEAM_DOMAIN) || !wrangler.vars.CF_ACCESS_AUD) {
    throw new Error('Set the Cloudflare Access team domain and application AUD tag before deployment.');
  }

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
