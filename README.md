# CursedCode

CursedCode is a minimal TypeScript Discord bot with one guild-scoped slash command: `/park`.

## What `/park` does

`/park channel:<voice-or-stage-channel>` makes the bot join the selected voice channel while self-muted and self-deafened.

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
   guildId = "your-test-guild-id"
   ```

4. Register the guild-scoped slash command:

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
- `pnpm register` registers the `/park` command in the configured guild.

## Notes

- `config.toml` is intentionally local and ignored by git.
- The bot only needs one test guild for this first version.
