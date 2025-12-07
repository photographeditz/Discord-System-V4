/**

 * bot.js

 * Cleaned startup file + ASCII startup banner (static)

 *

 * How to use:

 * 1. Install dependencies used by your project (mongoose, discord.js, etc.)

 * 2. Ensure @root/utils/... and @src/... modules path match your repo (or update requires)

 * 3. Set .env with BOT_TOKEN (and DB URI if needed)

 * 4. node bot.js

 *

 * Optional: set USE_FIGLET = true below and install `figlet` to use a dynamic ASCII title.

 */

'use strict';

// Toggle: if true, uses figlet to produce a dynamic big title instead of the static block

const USE_FIGLET = false;

// --- Core startup / environment ---

require('dotenv').config(); // load .env

// NOTE: Replace these paths with the real paths from your project.

const path = require('path');

// Example internal requires (adjust these to your actual files)

let checkForUpdates;

let initializeMongoose;

let BotClient;

let validateConfiguration;

try {

  // these are the likely modules inferred from your obfuscated file

  checkForUpdates = require('@root/utils/botUtils').checkForUpdates;

} catch (e) {

  // fallback: dummy function so file doesn't throw if module paths differ

  checkForUpdates = async () => {};

}

try {

  initializeMongoose = require('@root/utils/database/mongoose').initializeMongoose;

} catch (e) {

  initializeMongoose = async () => {};

}

try {

  BotClient = require('@src/core/BotClient').BotClient;

} catch (e) {

  // Provide a minimal fallback BotClient so devs can still run the file without the real class.

  class MinimalBotClient {

    constructor() {

      this.config = { DASHBOARD: { enabled: false } };

      this.logger = {

        log: console.log.bind(console),

        error: console.error.bind(console)

      };

    }

    loadCommands() {}

    loadCommandTests() {}

    loadEvents() {}

    async login(token) {

      if (!token) throw new Error('Missing token');

      this.logger.log('Pretend login with token:', token.slice ? (token.slice(0, 6) + '...') : token);

      // In real client, call discord.Client.login(token)

    }

  }

  BotClient = MinimalBotClient;

}

try {

  validateConfiguration = require('@root/utils/validateConfiguration').validateConfiguration;

} catch (e) {

  // no-op validate if missing

  validateConfiguration = () => {};

}

// --- ASCII banner definitions ---

// Static block inspired by the screenshot. Customize text below as needed.

const STATIC_ASCII_BANNER = `

 ██████╗ ██████╗  ██████╗ ██╗  ██╗███████╗██╗  ██╗██╗  ██╗

██╔════╝██╔═══██╗██╔═══██╗██║ ██╔╝██╔════╝██║ ██╔╝██║ ██╔╝

██║     ██║   ██║██║   ██║█████╔╝ █████╗  █████╔╝ █████╔╝ 

██║     ██║   ██║██║   ██║██╔═██╗ ██╔══╝  ██╔═██╗ ██╔═██╗ 

╚██████╗╚██████╔╝╚██████╔╝██║  ██╗███████╗██║  ██╗██║  ██╗

 ╚═════╝ ╚═════╝  ╚═════╝ ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝

╔════════════════════════════════════════════════════════════╗

║                                                            ║

║   Developer: Shaad You                                      ║

║   Support:   https://discord.gg/mFEehCPKEW                  ║

║   Made By:   Code Nexus                                     ║

║                                                            ║

╚════════════════════════════════════════════════════════════╝

`;

// Optionally use figlet for dynamic title

async function printStartupBanner() {

  if (USE_FIGLET) {

    try {

      const figlet = require('figlet'); // npm i figlet

      const titleText = figlet.textSync('MAD NEXUS', { font: 'Big' });

      console.log('\n' + '='.repeat(70) + '\n');

      console.log(titleText);

      console.log('\n🔹 Developer: Shaad You');

      console.log('🔹 Support: https://discord.gg/mFEehCPKEW');

      console.log('🔹 Made By Code Nexus\n');

      console.log('='.repeat(70) + '\n');

      return;

    } catch (err) {

      // If figlet not available, fallback to static

      console.warn('figlet not installed or failed to run, using static banner. Install figlet with `npm i figlet` to enable it.');

      console.log(STATIC_ASCII_BANNER);

      return;

    }

  } else {

    console.log(STATIC_ASCII_BANNER);

  }

}

// --- Main bot startup (clean, readable version of your obfuscated flow) ---

(async () => {

  // Print the banner first

  await printStartupBanner();

  // validate configuration (throws if invalid)

  try {

    validateConfiguration();

  } catch (err) {

    console.error('Configuration validation failed:', err);

    process.exit(1);

  }

  // Create bot client

  const client = new BotClient();

  // Provide safe checks for methods that existed in your original

  if (typeof client.loadCommands === 'function') {

    try {

      client.loadCommands('commands'); // adapt path as needed

    } catch (err) {

      client.logger && client.logger.error && client.logger.error('Failed to load commands:', err);

    }

  }

  if (typeof client.loadCommandTests === 'function') {

    try {

      client.loadCommandTests('commands/tests'); // optional

    } catch (err) {

      client.logger && client.logger.error && client.logger.error('Failed to load command tests:', err);

    }

  }

  if (typeof client.loadEvents === 'function') {

    try {

      client.loadEvents('src/events');

    } catch (err) {

      client.logger && client.logger.error && client.logger.error('Failed to load events:', err);

    }

  }

  // Global unhandledRejection logging

  process.on('unhandledRejection', (err) => {

    try {

      if (client && client.logger && typeof client.logger.error === 'function') {

        client.logger.error('unhandledRejection', err);

      } else {

        console.error('unhandledRejection', err);

      }

    } catch (e) {

      console.error('Error logging unhandledRejection:', e);

    }

  });

  // Startup flow: check updates -> dashboard or DB -> login

  try {

    // Optionally check for updates (network)

    await checkForUpdates();

    // If dashboard is enabled in client config, try to launch it

    const hasDashboard = client && client.config && client.config.DASHBOARD && client.config.DASHBOARD.enabled;

    if (hasDashboard) {

      try {

        // Example path - update to match your project

        const dashboardLauncher = require('@root/dashboard/launch');

        if (dashboardLauncher && typeof dashboardLauncher.launch === 'function') {

          client.logger && client.logger.log && client.logger.log('Launching dashboard...');

          await dashboardLauncher.launch(client);

        } else {

          client.logger && client.logger.warn && client.logger.warn('Dashboard launch module not found or invalid.');

        }

      } catch (err) {

        client.logger && client.logger.error && client.logger.error('Failed to launch dashboard', err);

        // continue startup; do not block login for dashboard failure

      }

    } else {

      // Initialize DB (mongoose)

      try {

        await initializeMongoose();

      } catch (err) {

        client.logger && client.logger.error && client.logger.error('Failed to initialize database:', err);

        // It's often fatal if DB is required; choose to exit or continue based on your needs:

        // process.exit(1);

      }

    }

    // Login

    const token = process.env.BOT_TOKEN;

    if (!token) {

      client.logger && client.logger.error && client.logger.error('BOT_TOKEN not set in environment. Exiting.');

      process.exit(1);

    }

    await client.login(token);

    client.logger && client.logger.log && client.logger.log('Bot started successfully.');

  } catch (err) {

    try {

      client && client.logger && client.logger.error && client.logger.error('Startup error', err);

    } catch (_) {

      console.error('Startup error', err);

    }

    // fatal error

    process.exit(1);

  }

})();
