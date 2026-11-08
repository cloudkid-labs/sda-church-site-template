import React, { useEffect, useMemo, useState } from 'react';
import { CmsPage, createEmptyCmsPage, localize, validateCmsPage } from '@cloudkid-labs/sda-church-site-core';
import { DEFAULT_PAGES } from '../data/default-pages.js';
import { site } from '../site-config.js';

const h = React.createElement;

export function ChurchApp({ initialPages = DEFAULT_PAGES, initialSlug = 'home', initialLoaded = false, forceAdmin = false }) {
  const [pages, setPages] = useState(initialPages);
  const [locale, setLocale] = useState(site.defaultLocale);
  const [loaded, setLoaded] = useState(initialLoaded);
  const [routeSlug, setRouteSlug] = useState(initialSlug);

  async function reload() {
    try {
      const endpoint = forceAdmin ? '/api/cms/pages' : '/api/public/pages';
      const response = await fetch(endpoint, { cache: 'no-store' });
      if (response.ok) setPages(await response.json());
    } catch {
      // Keep the committed sample content available if the Worker API is offline.
    } finally {
      setLoaded(true);
    }
  }

  useEffect(() => { void reload(); }, []);
  useEffect(() => {
    if (forceAdmin) return;
    const route = window.location.pathname.split('/').filter(Boolean)[0] ?? 'home';
    setRouteSlug(route);
  }, [forceAdmin, initialSlug]);
  useEffect(() => { document.documentElement.lang = locale; }, [locale]);

  const configuredSite = useMemo(() => ({ ...site, pages: pages.map((item) => ({
    slug: item.slug === 'home' ? '' : item.slug,
    home: item.slug === 'home',
    enabled: item.enabled !== false,
    title: item.title,
    navigation: item.slug !== 'home',
  })) }), [pages]);
  const page = pages.find((candidate) => candidate.slug === routeSlug && candidate.enabled !== false);
  if (forceAdmin) return h(CmsEditor, { pages, locale, setLocale, reload, loaded });
  if (!loaded && !page) return h('main', { className: 'template-loading' }, 'Loading…');
  if (!page) return h('main', { className: 'template-loading' }, h('h1', null, locale === 'af' ? 'Bladsy nie gevind nie' : 'Page not found'));

  return h(React.Fragment, null,
    h('div', { className: 'template-language' },
      h('button', { type: 'button', onClick: () => setLocale('af'), 'aria-pressed': locale === 'af' }, 'AF'),
      h('button', { type: 'button', onClick: () => setLocale('en'), 'aria-pressed': locale === 'en' }, 'EN'),
    ),
    h(CmsPage, { site: configuredSite, page, locale, currentPath: `${routeSlug === 'home' ? '' : `/${routeSlug}`}/` }),
  );
}

function CmsEditor({ pages, locale, setLocale, reload, loaded }) {
  const initialSlug = pages[0]?.slug ?? 'home';
  const [selected, setSelected] = useState(initialSlug);
  const [draft, setDraft] = useState(() => {
    const initial = pages.find((page) => page.slug === initialSlug);
    return initial ? structuredClone(initial) : null;
  });
  const [message, setMessage] = useState('');
  const current = pages.find((page) => page.slug === selected);

  useEffect(() => { if (current) setDraft(structuredClone(current)); }, [selected, current]);
  const updateText = (field, lang, value) => setDraft((page) => ({ ...page, [field]: { ...(page?.[field] ?? {}), [lang]: value } }));
  const updateBlock = (index, field, lang, value) => setDraft((page) => {
    const blocks = page.blocks.slice();
    blocks[index] = { ...blocks[index], [field]: { ...(blocks[index][field] ?? {}), [lang]: value } };
    return { ...page, blocks };
  });
  const updateCard = (index, cardIndex, field, lang, value) => setDraft((page) => {
    const blocks = page.blocks.slice();
    const cards = blocks[index].cards.slice();
    cards[cardIndex] = { ...cards[cardIndex], [field]: { ...(cards[cardIndex][field] ?? {}), [lang]: value } };
    blocks[index] = { ...blocks[index], cards };
    return { ...page, blocks };
  });

  async function save() {
    const validation = validateCmsPage(draft);
    if (!validation.ok) { setMessage(`Check: ${validation.errors.join(', ')}`); return; }
    const response = await fetch('/api/cms/pages', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(draft),
    });
    setMessage(response.ok ? 'Saved.' : `Save failed (${response.status}). Check CMS access.`);
    if (response.ok) await reload();
  }

  async function addPage() {
    const slug = window.prompt('Page slug (lowercase, hyphenated):');
    if (!slug) return;
    const page = createEmptyCmsPage(slug);
    const response = await fetch('/api/cms/pages', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(page) });
    if (!response.ok) { setMessage(`Could not add page (${response.status}).`); return; }
    await reload(); setSelected(slug);
  }

  async function removePage() {
    if (selected === 'home' || !window.confirm(`Hide and remove /${selected}/?`)) return;
    const response = await fetch(`/api/cms/pages?slug=${encodeURIComponent(selected)}`, { method: 'DELETE' });
    setMessage(response.ok ? 'Page removed.' : `Remove failed (${response.status}).`);
    if (response.ok) { setSelected('home'); await reload(); }
  }

  if (!loaded) return h('main', { className: 'cms-editor' }, 'Loading CMS…');
  if (!draft) return h('main', { className: 'cms-editor' }, 'No pages are available.');

  return h('main', { className: 'cms-editor' },
    h('header', { className: 'cms-editor__top' },
      h('a', { href: '/' }, localize(site.name, locale)),
      h('div', { className: 'template-language' },
        h('button', { type: 'button', onClick: () => setLocale('af') }, 'AF'),
        h('button', { type: 'button', onClick: () => setLocale('en') }, 'EN'),
      ),
    ),
    h('h1', null, locale === 'af' ? 'Webwerf inhoud' : 'Website content'),
    h('p', null, locale === 'af' ? 'Wysig bladsye en afdelings. Veranderinge raak net hierdie kerk se webwerf.' : 'Edit pages and sections. Changes affect only this church website.'),
    h('label', { className: 'cms-field' }, locale === 'af' ? 'Bladsy' : 'Page',
      h('select', { value: selected, onChange: (event) => setSelected(event.target.value) }, pages.map((page) => h('option', { key: page.slug, value: page.slug }, `/${page.slug}/`))),
    ),
    h('label', { className: 'cms-check' },
      h('input', { type: 'checkbox', checked: draft.enabled !== false, disabled: selected === 'home', onChange: (event) => setDraft({ ...draft, enabled: event.target.checked }) }),
      locale === 'af' ? 'Bladsy sigbaar' : 'Page visible',
    ),
    h('label', { className: 'cms-check' },
      h('input', { type: 'checkbox', checked: draft.status !== 'draft', onChange: (event) => setDraft({ ...draft, status: event.target.checked ? 'live' : 'draft' }) }),
      locale === 'af' ? 'Publiseer bladsy' : 'Publish page',
    ),
    ['title', 'intro'].map((field) => h('fieldset', { className: 'cms-fieldset', key: field },
      h('legend', null, field === 'title' ? (locale === 'af' ? 'Titel' : 'Title') : (locale === 'af' ? 'Inleiding' : 'Introduction')),
      ...['af', 'en'].map((lang) => h('label', { className: 'cms-field', key: `${field}-${lang}` }, lang.toUpperCase(),
        field === 'title'
          ? h('input', { value: draft[field]?.[lang] ?? '', onChange: (event) => updateText(field, lang, event.target.value) })
          : h('textarea', { rows: 3, value: draft[field]?.[lang] ?? '', onChange: (event) => updateText(field, lang, event.target.value) }),
      )),
    )),
    h('section', { className: 'cms-blocks' },
      h('div', { className: 'cms-blocks__heading' }, h('h2', null, locale === 'af' ? 'Afdelings' : 'Sections'),
        h('button', { type: 'button', onClick: () => setDraft({ ...draft, blocks: [...draft.blocks, { id: crypto.randomUUID(), type: 'text', enabled: true, heading: { af: '', en: '' }, body: { af: '', en: '' } }] }) }, locale === 'af' ? 'Voeg teksafdeling by' : 'Add text section'),
        h('button', { type: 'button', onClick: () => setDraft({ ...draft, blocks: [...draft.blocks, { id: crypto.randomUUID(), type: 'callout', enabled: true, heading: { af: '', en: '' }, body: { af: '', en: '' } }] }) }, locale === 'af' ? 'Voeg uitlig-afdeling by' : 'Add callout section'),
        h('button', { type: 'button', onClick: () => setDraft({ ...draft, blocks: [...draft.blocks, { id: crypto.randomUUID(), type: 'cardGrid', enabled: true, heading: { af: '', en: '' }, cards: [{ title: { af: '', en: '' }, body: { af: '', en: '' } }] }] }) }, locale === 'af' ? 'Voeg kaartafdeling by' : 'Add card section'),
        h('button', { type: 'button', onClick: () => setDraft({ ...draft, blocks: [...draft.blocks, { id: crypto.randomUUID(), type: 'map', enabled: true }] }) }, locale === 'af' ? 'Voeg kaart by' : 'Add map'),
      ),
      ...(draft.blocks ?? []).map((block, index) => h('article', { className: 'cms-block-editor', key: block.id ?? index },
        h('header', null,
          h('strong', null, block.type === 'callout' ? 'Callout' : block.type === 'cardGrid' ? 'Cards' : block.type === 'map' ? (locale === 'af' ? 'Kaart' : 'Map') : 'Text'),
          h('label', { className: 'cms-check' }, h('input', { type: 'checkbox', checked: block.enabled !== false, onChange: (event) => { const blocks = draft.blocks.slice(); blocks[index] = { ...block, enabled: event.target.checked }; setDraft({ ...draft, blocks }); } }), locale === 'af' ? 'Sigbaar' : 'Visible'),
          h('button', { type: 'button', onClick: () => setDraft({ ...draft, blocks: draft.blocks.filter((_, i) => i !== index) }) }, locale === 'af' ? 'Verwyder afdeling' : 'Remove section'),
        ),
        ...(block.type === 'map'
          ? [h('p', { key: 'map-help' }, locale === 'af' ? 'Die kaart gebruik die adres en koördinate in die kerkinstellings.' : 'The map uses the address and coordinates in the church settings.')]
          : block.type === 'cardGrid'
          ? [
              h('fieldset', { className: 'cms-fieldset', key: 'heading' },
                h('legend', null, locale === 'af' ? 'Opskrif' : 'Heading'),
                ...['af', 'en'].map((lang) => h('label', { className: 'cms-field', key: lang }, lang.toUpperCase(), h('input', { value: block.heading?.[lang] ?? '', onChange: (event) => updateBlock(index, 'heading', lang, event.target.value) }))),
              ),
              ...(block.cards ?? []).map((card, cardIndex) => h('div', { className: 'cms-card-editor', key: cardIndex },
                h('strong', null, `${locale === 'af' ? 'Kaart' : 'Card'} ${cardIndex + 1}`),
                ...['title', 'body'].map((field) => h('fieldset', { className: 'cms-fieldset', key: field },
                  h('legend', null, field === 'title' ? (locale === 'af' ? 'Titel' : 'Title') : (locale === 'af' ? 'Teks' : 'Text')),
                  ...['af', 'en'].map((lang) => h('label', { className: 'cms-field', key: `${field}-${lang}` }, lang.toUpperCase(),
                    field === 'title'
                      ? h('input', { value: card[field]?.[lang] ?? '', onChange: (event) => updateCard(index, cardIndex, field, lang, event.target.value) })
                      : h('textarea', { rows: 3, value: card[field]?.[lang] ?? '', onChange: (event) => updateCard(index, cardIndex, field, lang, event.target.value) }),
                  )),
                )),
                h('button', { type: 'button', onClick: () => { const blocks = draft.blocks.slice(); blocks[index] = { ...block, cards: block.cards.filter((_, i) => i !== cardIndex) }; setDraft({ ...draft, blocks }); } }, locale === 'af' ? 'Verwyder kaart' : 'Remove card'),
              )),
              h('button', { type: 'button', key: 'add-card', onClick: () => { const blocks = draft.blocks.slice(); blocks[index] = { ...block, cards: [...(block.cards ?? []), { title: { af: '', en: '' }, body: { af: '', en: '' } }] }; setDraft({ ...draft, blocks }); } }, locale === 'af' ? 'Voeg kaart by' : 'Add card'),
            ]
          : ['heading', 'body'].map((field) => h('fieldset', { className: 'cms-fieldset', key: field },
              h('legend', null, field === 'heading' ? (locale === 'af' ? 'Opskrif' : 'Heading') : (locale === 'af' ? 'Teks' : 'Text')),
              ...['af', 'en'].map((lang) => h('label', { className: 'cms-field', key: `${field}-${lang}` }, lang.toUpperCase(),
                field === 'heading'
                  ? h('input', { value: block[field]?.[lang] ?? '', onChange: (event) => updateBlock(index, field, lang, event.target.value) })
                  : h('textarea', { rows: 4, value: block[field]?.[lang] ?? '', onChange: (event) => updateBlock(index, field, lang, event.target.value) }),
              )),
            )),
        ),
      )),
    ),
    h('footer', { className: 'cms-editor__actions' },
      h('button', { type: 'button', onClick: save }, locale === 'af' ? 'Stoor veranderinge' : 'Save changes'),
      selected !== 'home' && h('button', { type: 'button', onClick: removePage }, locale === 'af' ? 'Verwyder bladsy' : 'Remove page'),
      h('button', { type: 'button', onClick: addPage }, locale === 'af' ? 'Voeg bladsy by' : 'Add page'),
      h('span', { role: 'status' }, message),
    ),
  );
}
