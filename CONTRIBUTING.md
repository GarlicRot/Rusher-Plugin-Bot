<p align="center">
  <img src="assets/Avatar.png" alt="Rusher Plugin Bot Avatar" width="160">
</p>

# Contributing to Rusher Plugin Bot

Thanks for helping improve Rusher Plugin Bot! Bug reports, feature ideas, documentation updates, and code contributions are welcome.

## Getting Started

Before opening a new issue or pull request, check whether someone has already reported the problem or suggested the feature.

- **Bug reports:** Include what you expected, what actually happened, steps to reproduce it, and relevant error messages or screenshots.
- **Feature requests:** Explain the use case and how the change would help people using the bot.
- **Registry corrections:** Plugin details and listed Minecraft versions come from the [official RusherDevelopment registry](https://github.com/RusherDevelopment/rusherhack-plugins/blob/main/data/plugins-and-themes.yml). Submit corrections to that upstream project rather than hardcoding them in this bot.

## Development Setup

Use **Node.js 24**, the version used by this project's GitHub Actions workflow.

```bash
git clone https://github.com/GarlicRot/Rusher-Plugin-Bot.git
cd Rusher-Plugin-Bot
npm ci
```

For local bot testing, create your own **Git-ignored** `.env` file with a development Discord bot token. The app reads `DISCORD_TOKEN` at startup; `CLIENT_ID`, `GUILD_ID`, and `NODE_ENV` are used for development command registration. `GITHUB_TOKEN` is optional but helps with GitHub API rate limits. **Never commit or share your tokens.**

```bash
npm start
```

Starting the bot does not register slash commands. The repository's `scripts/deploy-dev.js` is restricted to the maintainer's development application and test server. **Do not run `npm run register` against a production application**: it replaces that application's global slash commands.

## Project Structure

| Path | Purpose |
| --- | --- |
| `src/commands/` | Slash commands, including search and refresh |
| `src/events/` | Discord interaction and event handling |
| `src/utils/` | Registry loading, GitHub metadata, embeds, and shared helpers |
| `src/cache/` | Fallback snapshot of the official plugin/theme registry |
| `test/` | Automated regression tests |
| `scripts/` | Command-registration scripts |
| `.github/workflows/` | Continuous integration and changelog automation |

The official YAML registry is the source of truth for plugin information. Avoid hardcoding plugin names, compatibility versions, or GitHub statistics. In particular, **do not include incidental changes to `src/cache/plugins-and-themes.yml`** caused by a routine registry refresh unless that file is intentionally part of your change.

## Before Submitting a Pull Request

Run the project checks:

```bash
node --test test/*.test.js
npm audit --omit=dev
git diff --check
```

If you changed JavaScript files, check their syntax with `node --check path/to/file.js`. Test affected Discord commands, autocomplete, and pagination using a **development bot**, not the production application.

When opening a pull request:

1. Use a descriptive title and explain what changed and why.
2. Link any related issues and describe how you tested the change.
3. Include screenshots for changes to embeds or other visible bot output.
4. Keep unrelated changes and automatically refreshed cache files out of the PR.

## Coding Guidelines

- Match the existing **CommonJS** style (`require` and `module.exports`); use `async`/`await` for asynchronous work.
- Keep changes focused, readable, and consistent with nearby code.
- Reuse existing helpers instead of duplicating functionality.
- Handle Discord and GitHub API failures gracefully, and avoid breaking searches when optional GitHub metadata is unavailable.
- Add or update regression tests when changing behavior.
- Never commit credentials, personal tokens, or private server configuration.

## Changelog

You do not need to edit `CHANGELOG.md` manually. GitHub Actions generates it from commit history after updates to `main`.

## Thanks

Every well-documented issue, thoughtful suggestion, and tested contribution helps make Rusher Plugin Bot better for the community.
