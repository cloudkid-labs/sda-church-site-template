export const DEFAULT_PAGES = [
  {
    slug: 'home',
    enabled: true,
    title: { af: 'Welkom', en: 'Welcome' },
    eyebrow: { af: 'Seventh-day Adventist', en: 'Seventh-day Adventist' },
    intro: { af: 'Vind diensinligting en leer meer oor ons gemeente.', en: 'Find service information and learn about our congregation.' },
    blocks: [
      {
        id: 'welcome', type: 'text', enabled: true,
        heading: { af: 'Welkom by ons kerk', en: 'Welcome to our church' },
        body: { af: 'Hierdie teks kan deur die kerk se CMS verander word.', en: 'This text can be changed in the church CMS.' },
      },
      {
        id: 'service-times', type: 'cardGrid', enabled: true,
        heading: { af: 'Erediens tye', en: 'Service times' },
        cards: [
          { title: { af: 'Sabbatskool', en: 'Sabbath School' }, body: { af: 'Voeg die tyd by.', en: 'Add the time.' } },
          { title: { af: 'Erediens', en: 'Divine service' }, body: { af: 'Voeg die tyd by.', en: 'Add the time.' } },
        ],
      },
    ],
  },
  {
    slug: 'about',
    enabled: true,
    title: { af: 'Oor ons', en: 'About us' },
    eyebrow: { af: 'Ons gemeente', en: 'Our congregation' },
    intro: { af: 'Vertel besoekers van jou gemeente.', en: 'Tell visitors about your congregation.' },
    blocks: [],
  },
];
