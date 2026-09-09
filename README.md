# RepairSense

A compact repair-operations starter built with Next.js App Router, TypeScript,
Tailwind CSS, Lucide React, Prisma, and SQLite.

## Development

```bash
cp .env.example .env
npm install
npm run db:generate
npm run db:migrate
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Commands

- `npm run dev` — start the development server
- `npm run build` — create a production build
- `npm run lint` — run ESLint
- `npm run db:generate` — generate Prisma Client
- `npm run db:migrate` — create and apply development migrations
- `npm run db:studio` — open Prisma Studio

The compact design tokens and component presets live in `src/app/globals.css`.
The initial repair-domain schema lives in `prisma/schema.prisma`.
