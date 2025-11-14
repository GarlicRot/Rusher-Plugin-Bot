# Rusher-Plugin-Bot

Rusher-Plugin-Bot is a Discord bot designed to explore and display information from the official RusherHacks Plugin and Theme registry. It provides fast, searchable access to plugin data directly inside Discord using slash commands and clean, structured embeds.

## Overview

The bot retrieves plugin and theme metadata from the public RusherDevelopment registry and formats it into clear informational responses. Its goal is to make discovering, comparing, and browsing RusherHacks extensions effortless without needing to search GitHub manually.

## What the Bot Can Do

### Search Plugins
Look up individual plugins by name and instantly view:
- Description and purpose  
- Latest release version  
- Supported Minecraft versions  
- Creator information  
- Repository link and metadata

### Search Themes
Find UI themes with the same searchable, structured layout used for plugins.

### Filter by Creator
List all plugins and themes made by a specific creator, with automatic pagination when needed.

### Filter by Minecraft Version
Show all plugins and themes that support a specific version or range of versions.

### Global Refresh
A developer-only command allows the bot to refresh its cached dataset from the live registry, ensuring results stay current.

## How It Works

- The bot retrieves the official `plugins-and-themes.yml` registry.
- Data is processed, normalized, and cached for speed and reliability.
- Slash commands feed this data into carefully formatted Discord embeds.
- GitHub metadata (stars, last update time, etc.) is automatically included when available.
