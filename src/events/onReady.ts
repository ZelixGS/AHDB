import { REST } from "@discordjs/rest";
import { Routes } from "discord-api-types/v9";
import { Client } from "discord.js";
import { CommandList } from "../commands/_CommandList.js";
import config from '../../config.json' assert { type: 'json' };

export const onReady = async (BOT: Client) => {
    const rest = new REST({ version: "9" }).setToken(config.TOKEN);
    const commandData = CommandList.map((command) => command.data.toJSON());

    for (const Guild of config.Guilds) {
        try {
            await rest.put(    
                Routes.applicationGuildCommands( BOT.user?.id || "missing id", Guild as string),
                { body: commandData }
            );
            
        } catch (error) {
            continue;
        }
    }
  
    console.log("Discord ready!");
};