# Project Brief: Huvudkontoret Identity Runtime MVP

You are helping implement an MVP/scaffolding for Huvudkontoret, an internet-native identity system.

CORE CONCEPT

Huvudkontoret is not “a website with pages”.
It is a system where:

huvudkontoret.tld/slug

is interpreted as:

HUVUDKONTORET = UI / chrome / portal
TLD           = perspective / design / color / feeling / POW
SLUG          = raw identity data / markdown / structured content

The same slug data can be rendered through different TLD perspectives.

Examples:

huvudkontoret.name/magnusrenholm
huvudkontoret.cv/magnusrenholm
huvudkontoret.dev/magnusrenholm

All use the same underlying person/node data, but render it differently.

----------------------------------------------------------------

PHILOSOPHY

Build a rendering system for identity, not a conventional website.

The key abstraction is:

render(node, perspective)

Examples:

render("magnusrenholm", "name")
render("magnusrenholm", "cv")

This renders the same person through different lenses.

----------------------------------------------------------------

THE THREE LAYERS

1. HUVUDKONTORET LAYER

This is the constant system chrome.

Responsible for:
- routing
- global UI shell
- navigation
- shared components
- metadata
- layout primitives
- typography base
- interaction patterns
- system identity

Visual feeling:
- clean
- structured
- reliable
- light
- functional
- slightly institutional
- not corporate
- not SaaS generic

Think:
- portal
- operating system
- browser chrome
- identity runtime

----------------------------------------------------------------

2. TLD LAYER

This is the perspective.

Responsible for:
- color
- accent
- mood
- layout emphasis
- presentation style
- component variants
- tone
- POW

Each TLD has a role:

.name = identity / person / portrait / bio
.cv   = capability / experience / skills / matching
.dev  = toolchain / stack / technical practice
.ai   = signal / intelligence / insights
.club = belonging / network / community
.blog = flow / thinking / writing
.link = distribution / sharing

For this MVP, implement only:

.name
.cv

----------------------------------------------------------------

3. SLUG LAYER

This is the raw data.

Responsible for:
- person data
- bio
- images
- experience
- skills
- focus areas
- links
- metadata
- markdown/MDX content

The slug should be portable, structured and machine-readable.

The slug should not know how it will be rendered.

----------------------------------------------------------------

MVP SCOPE

Build:

One node. Two perspectives.

The node:

magnusrenholm

The perspectives:

/name/magnusrenholm
/cv/magnusrenholm

These should both render from the same underlying data source.

Do not build:
- auth
- database
- admin UI
- SaaS functionality
- over-engineered infrastructure

Start with static local data.

----------------------------------------------------------------

RECOMMENDED STACK

Use:
- Astro (static site, content-first)
- TypeScript
- Tailwind CSS v4
- YAML content via Astro Content Collections
- Local file-based content
- Simple design tokens
- Component-driven architecture

Suggested structure:

/src
  /pages
    index.astro              ← redirect to /name/magnusrenholm
    /name/[slug].astro
    /cv/[slug].astro

  /layouts
    Shell.astro              ← shared chrome shell

  /content
    /nodes
      magnusrenholm.yaml

  content.config.ts          ← Astro content collection schema

  /lib
    tokens.ts
    types.ts

  /styles
    global.css

----------------------------------------------------------------

DATA MODEL

Create a simple typed data model for a person/node.

Example:

id: magnusrenholm
type: person
displayName: Magnus Renholm
slug: magnusrenholm
nodeId: "024"

title: Strateg. Teknolog. Byggare.

location:
  city: Luleå
  country: Sweden
  timezone: CET / UTC+1

summary: >
  Jag bygger system som skapar verklig effekt över tid.

bio: >
  Jag arbetar i gränslandet mellan teknik, produkt och organisation.
  Fokus på skalbara system, tydliga arkitekturer och team som kan
  leverera med hög kvalitet över tid.

currentFocus:
  - AI-infrastruktur
  - Produktutveckling
  - Systemarkitektur
  - Team & kultur

principles:
  - People first. Always.
  - Build systems, not dependencies.
  - Signal over noise.
  - Tools should disappear.
  - The map is not the territory.
  - Leave things better than you found them.

skills:
  - name: System Design
    level: 98
    category: Architecture

  - name: Architecture
    level: 96
    category: Architecture

  - name: AI / ML
    level: 94
    category: AI

  - name: Leadership
    level: 92
    category: Leadership

  - name: Product Strategy
    level: 90
    category: Product

  - name: Data Systems
    level: 88
    category: Data

experience:
  - company: Huvudkontoret.dev
    role: Founder & Systems Architect
    period: 2022-
    description: Bygger system, verktyg och identitetsinfrastruktur.

  - company: Spotify
    role: Engineering Manager
    period: 2017-2019
    description: Arbetade med modularisering, teamstrukturer och teknisk infrastruktur.

  - company: H&M
    role: Team Lead / Mobile Architect
    period: 2015-2017
    description: Native iOS/Android, arkitektur och onboarding av interna team.

  - company: Blocket
    role: Mobile Developer
    period: 2012-2015
    description: Native mobilutveckling och produktutveckling.

links:
  linkedin: https://www.linkedin.com/in/msson
  email: magnus.renholm@gmail.com

availability:
  status: Available
  from: Q3 2026

standardCv:
  headline: Senior Mobile Engineer / Fullstack Architect
  yearsExperience: 15+
  deliveries: 25+
  coreCompetencies:
    - Native iOS/Android
    - Cross-platform architecture
    - C++ core components
    - AI tooling
    - Product strategy
    - Technical leadership

----------------------------------------------------------------

VISUAL DIRECTION

The UI should be light, clear and structured, with distinct TLD color accents.

Avoid:
- gray/beige premium consulting look
- generic SaaS dashboard
- corporate LinkedIn clone
- cyberpunk overload
- dark-only AI startup style

Use:
- light background
- black text
- strong but tasteful color accents
- soft cards
- rounded corners
- clear grid
- monospaced metadata
- small doodle/marginalia details
- subtle artifact feeling

Overall feeling:

Serious tools + human traces + institutional weirdness

----------------------------------------------------------------

DESIGN TOKENS

Create token config like:

export const tldTokens = {
  name: {
    label: ".name",
    role: "Identity",
    pow: "Personporträtt / bio / människa",
    accent: "coral",
    accentHex: "#ff5c7a",
    softBg: "#fff1f4",
  },

  cv: {
    label: ".cv",
    role: "Capability",
    pow: "Erfarenhet / skills / matchning",
    accent: "mint",
    accentHex: "#12b981",
    softBg: "#ecfdf5",
  },

  dev: {
    label: ".dev",
    role: "Toolchain",
    accentHex: "#22c55e",
  },

  ai: {
    label: ".ai",
    role: "Signal",
    accentHex: "#22d3ee",
  },

  club: {
    label: ".club",
    role: "Belonging",
    accentHex: "#8b5cf6",
  },
}

----------------------------------------------------------------

.NAME PERSPECTIVE

.name is the human/person perspective.

It should feel like:
- editorial profile
- person portrait
- bio
- identity
- focus
- philosophy
- “who is this person?”

It should NOT feel like a CV first.

Page sections:
1. Global Huvudkontoret chrome
2. TLD sidebar or TLD selector
3. Hero with portrait, name, title and personal quote
4. Bio / current focus
5. Principles
6. Areas of work
7. “Thoughts right now” note/card
8. Embedded “standard CV” card as supporting material
9. Network / links
10. Footer with signal/noise/system metadata

Design:
- accent: coral / pink / warm red
- lots of whitespace
- portrait prominent
- handwritten-style accent marks allowed
- calm, human, readable

Important:
.name may include a compact embedded CV card,
but the CV is not the main content.

----------------------------------------------------------------

.CV PERSPECTIVE

.cv is the professional capability perspective.

It should feel like:
- structured experience
- skills
- matching
- export
- AI-assisted opportunity matching
- fast understanding of capability

It should NOT feel like a personal biography.

Page sections:
1. Global Huvudkontoret chrome
2. Standard CV overview
3. Experience timeline
4. Skill graph/list
5. AI matching prompt area:
   - textarea
   - “Klistra in en uppdragsbeskrivning”
   - button “Matcha uppdrag”
6. Mock matching result card
7. Export actions:
   - PDF
   - DOCX
   - JSON
   - Share link
8. Availability
9. Relevant deliveries

Design:
- accent: green/mint + optional lilac support
- more dashboard-like
- structured cards
- bars/charts allowed
- clear hierarchy
- denser than .name

For now, matching can be mocked locally.
No real AI API required in MVP.

----------------------------------------------------------------

CHROME / SHELL

Build one shared shell used by all perspectives.

It should visually communicate:

Huvudkontoret = UI/chrome
TLD = style/perspective
Slug = data

Chrome includes:
- HK / # mark
- URL-like bar
- current route
- TLD navigation
- node status
- small metadata
- consistent layout

Example URL display:

huvudkontoret.name/magnusrenholm
huvudkontoret.cv/magnusrenholm

In local dev this can map to:

/name/magnusrenholm
/cv/magnusrenholm

----------------------------------------------------------------

IMPLEMENTATION GOAL

Create a working MVP that demonstrates:

Same slug data.
Different TLD perspective.
Shared Huvudkontoret chrome.

The first version should be beautiful enough to show internally to the team.

Prioritize:
1. clean architecture
2. data separation
3. strong visual proof-of-concept
4. easy iteration
5. readable code

----------------------------------------------------------------

DELIVERABLES

Implement:
- Next.js project scaffold
- typed node data model
- local content loader
- shared shell/chrome
- .name page
- .cv page
- basic responsive layout
- design tokens for TLDs
- mock matching prompt on .cv
- embedded CV card on .name
- README explaining architecture

----------------------------------------------------------------

README SHOULD EXPLAIN

# Huvudkontoret Identity Runtime

## Concept

Huvudkontoret is the chrome.
TLD is the perspective.
Slug is the data.

## MVP

One node, two perspectives:
- /name/magnusrenholm
- /cv/magnusrenholm

## Architecture

render(node, perspective)

## Next Steps

- add .dev perspective
- add real CV export
- add AI matching
- add multiple nodes
- add content editing
- add real domain routing

----------------------------------------------------------------

TONE

Keep the code and UI elegant, minimal and practical.

This is not a fantasy product.

The feeling should be:

A real tool from an internet-native institution.

Not:
- a startup landing page
- a fake cyberpunk brand
- a corporate CV platform

----------------------------------------------------------------

BEGIN

Start by:
1. creating the scaffold
2. implementing the data model
3. implementing the tokens
4. building the shared shell
5. implementing the two perspectives

Prefer simple static implementation over abstractions that are not yet needed.
Make reasonable decisions.
Optimize for iteration speed and conceptual clarity.
