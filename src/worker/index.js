import React from 'react';
import { renderToString } from 'react-dom/server';
import { isCmsSlug, validateCmsPage } from '@cloudkid-labs/sda-church-site-core/cms';
import { localize } from '@cloudkid-labs/sda-church-site-core';
import { ChurchApp } from '../components/ChurchApp.jsx';
import { DEFAULT_PAGES } from '../data/default-pages.js';
import { site } from '../site-config.js';

const json = (value, status = 200) => new Response(JSON.stringify(value), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});

async function getPages(bucket) {
  const merged = new Map(DEFAULT_PAGES.map((page) => [page.slug, page]));
  const removed = await bucket.list({ prefix: 'deleted/' });
  for (const object of removed.objects) merged.delete(object.key.slice('deleted/'.length));
  const saved = await bucket.list({ prefix: 'pages/' });
  for (const object of saved.objects) {
    const slug = object.key.slice('pages/'.length, -'.json'.length);
    const stored = await bucket.get(object.key);
    if (stored) merged.set(slug, await stored.json());
  }
  return [...merged.values()];
}

async function getPublicPages(bucket) {
  return (await getPages(bucket)).filter((page) => page.enabled !== false && page.status !== 'draft');
}

async function cms(request, env) {
  const url = new URL(request.url);
  const slug = url.searchParams.get('slug');
  if (request.method === 'GET') {
    const pages = await getPages(env.CMS);
    if (slug) return json(pages.find((page) => page.slug === slug) ?? { error: 'not found' }, pages.some((page) => page.slug === slug) ? 200 : 404);
    return json(pages);
  }

  // Cloudflare Access protects /admin/* and /api/cms/*, with workers.dev
  // disabled. This header check is defense in depth; Access is the auth layer.
  if (!request.headers.has('CF-Access-Jwt-Assertion')) return json({ error: 'unauthorized' }, 401);

  if (request.method === 'PUT') {
    const size = Number(request.headers.get('content-length') ?? 0);
    if (size > 65536) return json({ error: 'page is too large' }, 413);
    let input;
    try { input = await request.json(); } catch { return json({ error: 'invalid JSON' }, 400); }
    const result = validateCmsPage(input);
    if (!result.ok) return json({ error: 'invalid page', fields: result.errors }, 400);
    await env.CMS.delete(`deleted/${result.value.slug}`);
    await env.CMS.put(`pages/${result.value.slug}.json`, JSON.stringify(result.value), {
      httpMetadata: { contentType: 'application/json; charset=utf-8' },
    });
    return json(result.value);
  }

  if (request.method === 'DELETE') {
    if (!isCmsSlug(slug)) return json({ error: 'invalid slug' }, 400);
    await env.CMS.delete(`pages/${slug}.json`);
    await env.CMS.put(`deleted/${slug}`, 'removed');
    return new Response(null, { status: 204 });
  }

  return json({ error: 'method not allowed' }, 405);
}

function slugForPath(pathname) {
  const parts = pathname.split('/').filter(Boolean);
  return parts[0] ?? 'home';
}

function serialize(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
}

async function notFound(url, env, request) {
  const response = await env.ASSETS.fetch(new Request(new URL('/404.html', url), request));
  return new Response(response.body, { status: 404, headers: response.headers });
}

async function renderPage(request, env) {
  const url = new URL(request.url);
  const slug = slugForPath(url.pathname);
  const pages = await getPublicPages(env.CMS);
  const page = pages.find((candidate) => candidate.slug === slug);
  if (!page) return notFound(url, env, request);
  const htmlResponse = await env.ASSETS.fetch(new Request(new URL('/index.html', url), request));
  if (!htmlResponse.ok) return htmlResponse;

  const rendered = renderToString(React.createElement(ChurchApp, {
    initialPages: pages,
    initialSlug: slug,
    initialLoaded: true,
    forceAdmin: false,
  }));
  const snapshot = serialize({ pages, slug });
  const title = localize(page.title, site.defaultLocale, site.defaultLocale);
  const canonical = new URL(url.pathname.endsWith('/') ? url.pathname : `${url.pathname}/`, site.url || url.origin).href;
  let html = await htmlResponse.text();
  html = html.replace(/(<div id="app">)[\s\S]*?(<\/div>)/, (_match, open, close) => `${open}${rendered}${close}`);
  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(title)}</title>`);
  html = html.replace(/<link rel="canonical"[^>]*>/, `<link rel="canonical" href="${escapeHtml(canonical)}" />`);
  html = html.replace('</head>', `<script>window.__SDA_CMS_SNAPSHOT__=${snapshot};</script></head>`);
  const headers = new Headers(htmlResponse.headers);
  headers.set('content-type', 'text/html; charset=utf-8');
  headers.set('cache-control', 'public, max-age=60, stale-while-revalidate=300');
  return new Response(html, { status: 200, headers });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

function isAssetPath(pathname) {
  return pathname.startsWith('/_astro/') || /\.[a-z0-9]{1,8}$/i.test(pathname);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/public/pages') {
      if (request.method !== 'GET') return json({ error: 'method not allowed' }, 405);
      const slug = url.searchParams.get('slug');
      const pages = await getPublicPages(env.CMS);
      if (slug) return json(pages.find((page) => page.slug === slug) ?? { error: 'not found' }, pages.some((page) => page.slug === slug) ? 200 : 404);
      return json(pages);
    }
    if (url.pathname === '/api/cms/pages') return cms(request, env);
    if (url.pathname === '/admin' || url.pathname === '/admin/') {
      return env.ASSETS.fetch(new Request(new URL('/admin/index.html', url), request));
    }
    if (isAssetPath(url.pathname)) return env.ASSETS.fetch(request);
    return renderPage(request, env);
  },
};
