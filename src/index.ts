// Require the necessary discord.js classes
import config from '../config.json' assert { type: 'json' };
import { Client, Events, GatewayIntentBits } from "discord.js";
import { onInteraction } from './events/onInteraction.js';
import { onReady } from "./events/onReady.js";

// Create a new client instance
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers] });

client.on("ready", async () => await onReady(client));
client.on("interactionCreate", async (interaction) => await onInteraction(interaction))

client.login(config.TOKEN);