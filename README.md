# SDA church site template

This repository is the starter for an independent church website. It uses the shared `@cloudkid-labs/sda-church-site-core` React components and includes a bilingual CMS for adding, editing, enabling, and removing pages and page sections. Each church gets its own repository, CMS content bucket, Cloudflare Worker, domain, and deployment.

## Create a site

1. After this repository is enabled as a GitHub template, choose **Use this template** to create a new church repository.
2. Give the repository a church-specific name, then clone it.
3. Configure npm access to GitHub Packages. Add a classic token with `read:packages` to your local environment as `NODE_AUTH_TOKEN`.
4. Run `npm run setup` to set the church name, slug, domain, timezone, colors, map addresses and coordinates, package name, and Worker name.
5. Run `npm install`.
6. Create the R2 bucket named by `wrangler.jsonc`, add repository secrets `GH_PACKAGES_READ_TOKEN`, `CLOUDFLARE_API_TOKEN`, and `CLOUDFLARE_ACCOUNT_ID`, and set `PUBLIC_SITE_URL` as a repository variable.
7. In Cloudflare, protect `/admin*` and `/api/cms/*` with an Access application and restrict it to the church's authorized editors. Leave `/api/public/*` public. Confirm the Worker has no `workers.dev` endpoint, then dispatch **Deploy church site**.

Do not deploy while the sample configuration remains. `npm run setup` creates a custom domain route and an R2 bucket name, but the domain must belong to the church and be active in the same Cloudflare account. Create the bucket before deploying.

## Local development

```sh
npm install
npm run dev
```

The Astro preview shows the sample pages. To exercise CMS writes locally, run `npm run worker:dev`; Wrangler uses local R2 emulation. The editor and write API rely on Cloudflare Access in production.

## CMS content

Open `/admin` after configuring Access. The editor can add or remove pages, publish or hide them from navigation, add or remove text, callout, card, and map sections, edit Afrikaans and English copy, and save changes to the church's R2 bucket. The map uses the church address, coordinates, and directions links configured during setup. Public pages read only published and enabled content from `/api/public/pages`. CMS writes use `/api/cms/pages`, which must remain behind Access.

Page and section layout is shared through the core package; each site owns its content and theme. The core provides text, callout, card-grid, FAQ, image, link-list, and map blocks. Church-specific integrations stay in that church's repo.

## Core update policy

Dependabot checks GitHub Packages weekly. Add `GH_PACKAGES_READ_TOKEN` as a Dependabot secret and as an Actions secret in the repository. The included workflow enables auto-merge for patch and minor updates within the current major version only after the build succeeds. Major updates stay open for church review. Protect `main` and require the `Build church site / build` and `Require review for major core updates / major-core-review` checks; the latter remains failed until a maintainer approves a major update. Enable GitHub auto-merge in the repository settings.

## Independent deployment

The template only contains the site application and deployment workflow. Cloudflare resources and secrets are created separately in each church account. The deploy workflow is manual by default, so creating a repository from this template does not publish a site.
