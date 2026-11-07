import React from 'react';
import { hydrateRoot } from 'react-dom/client';
import { ChurchApp } from '../components/ChurchApp.jsx';
import { DEFAULT_PAGES } from '../data/default-pages.js';

const snapshot = window.__SDA_CMS_SNAPSHOT__;
const pathSlug = window.location.pathname.split('/').filter(Boolean)[0];
const initialProps = snapshot
  ? { initialPages: snapshot.pages, initialSlug: snapshot.slug, initialLoaded: true }
  : { initialPages: DEFAULT_PAGES, initialSlug: pathSlug ?? 'home', initialLoaded: true };
initialProps.forceAdmin = window.location.pathname.replace(/\/$/, '') === '/admin';
hydrateRoot(document.getElementById('app'), React.createElement(ChurchApp, initialProps));
