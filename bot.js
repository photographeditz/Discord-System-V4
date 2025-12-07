// bot.js
// Clean, readable startup file for "Discord System V4"
// - Uses dotenv
// - Uses module-alias (if you have @src etc configured)
// - Attempts to initialize mongoose, check updates, and launch dashboard if present
// - Loads commands/events by calling common methods or falling back to directory scanning
// - Prints an ASCII banner (customize ASCII_BANNER below)

'use strict';

// Basic setup
require('dotenv').config();                 // load .env
// If you use module-alias (recommended), ensure it's configured in package.json or use:
//   "moduleAliases": { "@src": "src", "@root": "." }
// and call:
// require('module-alias/register');
try {
  // try to register module-alias if available (optional)
  require('module-alias/register');
} catch (err) {
  // not required — only used if your project configured aliases
}

// ---------- CUSTOM ASCII BANNER (edit this string) ----------
const ASCII_BANNER = `
██████╗ ██╗ ██████╗ ████████╗ ██████╗  ██████╗ 
██╔══██╗██║██╔═══██╗╚══██╔══╝██╔═══██╗██╔════╝ 
██████╔╝██║██║   ██║   ██║   ██║   ██║██║  ███╗
██╔══██╗██║██║   ██║   ██║   ██║   ██║██║   ██║
██║  ██║██║╚██████╔╝   ██║   ╚██████╔╝╚██████╔╝
╚═╝  ╚═╝╚═╝ ╚═════╝    ╚═╝    ╚═════╝  ╚═════╝ 
          Discord System V4 — Dashboard Enabled
`;
// ----------------------------------------------------------------

const fs = require('fs');
const path = require('path');

const log = {
  info: (...args) => console.log('[INFO]', ...args),
  warn: (...args) => console.warn('[WARN]', ...args),
  error: (...args) => console.error('[ERROR]', ...args),
};

(async () => {
  console.log(ASCII_BANNER);

  // Try to require optional utilities -- fail gracefully with messages
  let checkForUpdates = null;
  try {
    // example: @root/utils/botUtils or ./dashboard/utils/botUtils
    checkForUpdates = require('./dashboard/utils/checkForUpdates').checkForUpdates
      || require('@root/utils/botUtils').checkForUpdates;
  } catch (e) {
    // optional
  }

  let initializeMongoose = null;
  try {
    initializeMongoose = require('./src/database/mongoose').initializeMongoose
      || require('@root/database/mongoose').initializeMongoose;
  } catch (e) {
    // optional
  }

  let validateConfiguration = null;
  try {
    validateConfiguration = require('./config').validateConfiguration
      || require('./src/config/validateConfiguration').validateConfiguration
      || require('@root/validation/validateConfiguration').validateConfiguration;
  } catch (e) {
    // optional
  }

  // Your BotClient implementation (should live in src/client/BotClient.js or similar)
  let BotClient = null;
  try {
    BotClient = require('./src/client/BotClient').BotClient
      || require('@src/client/BotClient').BotClient;
  } catch (e) {
    log.error('Could not require BotClient from src/client/BotClient. Make sure the file exists and exports { BotClient }.');
    // To avoid crash, provide a minimal fallback that uses discord.js Client (only for safety)
    try {
      const { Client, Intents } = require('discord.js');
      class FallbackClient extends Client {
        constructor(opts = {}) { super({ intents: Object.values(Intents.FLAGS) }); }
        async loadCommands() { /* noop fallback */ }
        async loadEvents() { /* noop fallback */ }
      }
      BotClient = { BotClient: FallbackClient }.BotClient;
      log.warn('Using fallback BotClient (discord.js Client). Replace with your actual BotClient implementation.');
    } catch (err) {
      log.error('discord.js not installed. Install discord.js or provide your BotClient implementation.');
      process.exit(1);
    }
  }

  // Validate configuration if validator exists
  try {
    if (typeof validateConfiguration === 'function') {
      validateConfiguration();
      log.info('Configuration validated.');
    } else {
      log.info('No configuration validator found (optional).');
    }
  } catch (err) {
    log.error('Configuration validation failed:', err);
    // depending on preference, you might exit here:
    // process.exit(1);
  }

  // Run update check if available
  try {
    if (typeof checkForUpdates === 'function') {
      await checkForUpdates();
      log.info('Update check complete.');
    } else {
      log.info('No update checker found (optional).');
    }
  } catch (err) {
    log.warn('Error while checking for updates (continuing):', err);
  }

  // Initialize mongoose (if available)
  try {
    if (typeof initializeMongoose === 'function') {
      await initializeMongoose();
      log.info('Mongoose initialized.');
    } else {
      log.info('No mongoose initializer found (skipping DB init).');
    }
  } catch (err) {
    log.warn('Failed to initialize mongoose (continuing):', err);
  }

  // Create the client instance
  const client = new BotClient(); // assume constructor takes (options) or none

  // Attach basic error handlers
  process.on('unhandledRejection', (reason, p) => {
    client?.logger?.error?.('Unhandled Rejection:', reason) || log.error('Unhandled Rejection:', reason);
  });
  process.on('uncaughtException', (err) => {
    client?.logger?.error?.('Uncaught Exception:', err) || log.error('Uncaught Exception:', err);
  });

  // Loading commands / events - try multiple common patterns so it fits many projects
  async function tryLoadCommands(clientInstance) {
    // 1) if your BotClient has loadCommands method
    if (typeof clientInstance.loadCommands === 'function') {
      try {
        await clientInstance.loadCommands();
        log.info('Commands loaded via client.loadCommands().');
        return;
      } catch (err) {
        log.warn('client.loadCommands() threw an error:', err);
      }
    }

    // 2) if you have a commands folder that exports individually
    const commandsPath = path.resolve(__dirname, 'src', 'commands');
    if (fs.existsSync(commandsPath)) {
      const files = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));
      for (const file of files) {
        try {
          const cmd = require(path.join(commandsPath, file));
          // If client has a commands Map, register it
          if (clientInstance.commands && typeof clientInstance.commands.set === 'function' && cmd.name) {
            clientInstance.commands.set(cmd.name, cmd);
          }
        } catch (err) {
          log.warn('Failed to load command', file, err);
        }
      }
      log.info('Commands loaded from src/commands (fallback).');
      return;
    }

    log.info('No commands loader found or commands folder not present; skipping commands load.');
  }

  async function tryLoadEvents(clientInstance) {
    // 1) client has loadEvents method
    if (typeof clientInstance.loadEvents === 'function') {
      try {
        await clientInstance.loadEvents();
        log.info('Events loaded via client.loadEvents().');
        return;
      } catch (err) {
        log.warn('client.loadEvents() threw an error:', err);
      }
    }

    // 2) fallback: read src/events and register files named event
    const eventsPath = path.resolve(__dirname, 'src', 'events');
    if (fs.existsSync(eventsPath)) {
      const files = fs.readdirSync(eventsPath).filter(f => f.endsWith('.js'));
      for (const file of files) {
        try {
          const ev = require(path.join(eventsPath, file));
          // ev should export: { name: 'ready', execute(client, ...args) { } } or function
          const eventName = ev.name || path.basename(file, '.js');
          if (typeof ev === 'function') {
            clientInstance.on(eventName, ev.bind(null, clientInstance));
          } else if (ev && typeof ev.execute === 'function') {
            clientInstance.on(eventName, ev.execute.bind(null, clientInstance));
          }
        } catch (err) {
          log.warn('Failed to load event', file, err);
        }
      }
      log.info('Events loaded from src/events (fallback).');
      return;
    }

    log.info('No events loader found or events folder not present; skipping events load.');
  }

  // Attempt to load commands/events
  try {
    await tryLoadCommands(client);
  } catch (err) {
    log.warn('Error while trying to load commands:', err);
  }
  try {
    await tryLoadEvents(client);
  } catch (err) {
    log.warn('Error while trying to load events:', err);
  }

  // Try to load event files under src/handlers or src/events, or a single events folder 'src/e...'
  // (This is intentionally permissive so it fits many projects)
  try {
    // If your client expects to watch an events path, call that method too
    const eventsDir = path.resolve(__dirname, 'src', 'events');
    if (client.registerEvents && fs.existsSync(eventsDir)) {
      await client.registerEvents(eventsDir);
      log.info('client.registerEvents(eventsDir) invoked.');
    }
  } catch (err) {
    // ignore
  }

  // Optional: Launch dashboard if present (dashboard launcher should export a launch(client) async function)
  async function tryLaunchDashboard(clientInstance) {
    const dashboardLauncherPaths = [
      path.resolve(__dirname, 'dashboard', 'launcher.js'),
      path.resolve(__dirname, 'dashboard', 'index.js'),
      path.resolve(__dirname, 'dashboard', 'server.js'),
      path.resolve(__dirname, 'src', 'dashboard', 'index.js'),
    ];

    for (const p of dashboardLauncherPaths) {
      if (fs.existsSync(p)) {
        try {
          const launcher = require(p);
          if (launcher && typeof launcher.launch === 'function') {
            await launcher.launch(clientInstance);
            log.info('Dashboard launched via', p);
            return true;
          } else if (typeof launcher === 'function') {
            // some launchers export the function directly
            await launcher(clientInstance);
            log.info('Dashboard launched via', p);
            return true;
          } else {
            log.warn('Dashboard file found but no launch function in', p);
          }
        } catch (err) {
          log.warn('Dashboard launcher at', p, 'failed:', err);
        }
      }
    }

    // fallback: try requiring a 'dashboard' package in project root
    try {
      const maybe = require('./dashboard');
      if (maybe && typeof maybe.launch === 'function') {
        await maybe.launch(clientInstance);
        log.info('Dashboard launched via ./dashboard export.');
        return true;
      }
    } catch (err) {
      // ignore
    }

    log.info('No dashboard detected or launcher failed; skipping dashboard start.');
    return false;
  }

  try {
    await tryLaunchDashboard(client);
  } catch (err) {
    log.warn('Error while attempting to launch dashboard (continuing):', err);
  }

  // Finally, login the bot
  const token = process.env.BOT_TOKEN || process.env.TOKEN;
  if (!token) {
    log.error('No BOT_TOKEN found in environment. Set BOT_TOKEN in .env or in environment variables.');
    process.exit(1);
  }

  try {
    if (typeof client.login === 'function') {
      await client.login(token);
      log.info('Bot logged in successfully.');
    } else {
      log.error('client.login is not a function. Ensure your BotClient extends discord.js Client or provides login(token).');
    }
  } catch (err) {
    log.error('Failed to login:', err);
    process.exit(1);
  }

})();
