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

### Test the camera from a mobile device

Mobile browsers require a trusted HTTPS connection for camera access. Create a
development certificate that includes the laptop's LAN address:

```bash
brew install mkcert
mkcert -install
mkdir -p .cert
mkcert -cert-file .cert/dev.pem -key-file .cert/dev-key.pem 10.100.102.171 localhost 127.0.0.1
npm run dev:https
```

Run `mkcert -CAROOT`, copy only `rootCA.pem` from that directory to the test
phone, and install it as a trusted CA certificate. Never copy `rootCA-key.pem`.
Then open [https://10.100.102.171:3000](https://10.100.102.171:3000). The LAN
development server bypasses authentication by default, regardless of whether it
is opened through localhost or the LAN address. Set `LOCAL_AUTH_BYPASS="false"`
to test Google authentication locally. Production builds always require authentication.

## Commands

- `npm run dev` — start the development server
- `npm run dev:https` — start HTTPS development for mobile camera testing
- `npm run build` — create a production build
- `npm run lint` — run ESLint
- `npm run db:generate` — generate Prisma Client
- `npm run db:migrate` — create and apply development migrations
- `npm run db:studio` — open Prisma Studio

The compact design tokens and component presets live in `src/app/globals.css`.
The initial repair-domain schema lives in `prisma/schema.prisma`.


## Update the LXC

cd /opt/repairsense/app
sudo -u repairsense git pull --ff-only
sudo -u repairsense npm ci
sudo -u repairsense sh -c 'set -a; . /etc/repairsense.env; set +a; npx prisma generate'
sudo -u repairsense sh -c 'set -a; . /etc/repairsense.env; set +a; npx prisma db push'
sudo -u repairsense sh -c 'set -a; . /etc/repairsense.env; set +a; npm run build'
sudo systemctl restart repairsense
sudo systemctl status repairsense
