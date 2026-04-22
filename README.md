# CursedCode

CursedCode is a minimal TypeScript Discord bot with one global slash command: `/park`.

## What `/park` does

`/park channel:<voice-or-stage-channel>` makes the bot join the selected voice channel while self-muted and self-deafened.

The bot stores one parked voice channel per guild in SQLite and will automatically reconnect to that channel after a process restart or an unexpected disconnect.

## Setup

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Copy the example config:

   ```bash
   cp config.example.toml config.toml
   ```

3. Fill in your Discord bot values in `config.toml`:

   ```toml
   [discord]
   token = "your-bot-token"
   clientId = "your-application-client-id"

   [database]
   path = "data/cursedcode.db"
   ```

4. Register the global slash command:

   ```bash
   pnpm register
   ```

5. Start the bot:

   ```bash
   pnpm dev
   ```

## Scripts

- `pnpm dev` runs the bot in development mode with `tsx`.
- `pnpm build` compiles TypeScript into `dist/`.
- `pnpm start` runs the compiled bot from `dist/`.
- `pnpm register` registers the global `/park` command for the application.

## Notes

- `config.toml` is intentionally local and ignored by git.
- Global command updates can take a little time to propagate across Discord.
- The SQLite database file defaults to `data/cursedcode.db`.
