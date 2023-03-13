import { SlashCommandBuilder } from "@discordjs/builders";
import { Command } from "../interfaces/Command.js";
import { ColorResolvable, EmbedBuilder } from "discord.js";
import { GetAuctionHouseData } from "../AuctionHouse.js";
import { ItemData } from "../interfaces/AuctionHouseData.js";

export const pricecheck: Command = {
    data: new SlashCommandBuilder()
        .setName("pc")
        .setDescription("Checks Auction House for most recent price.")
        .addStringOption((option) =>
        option
            .setName("item")
            .setDescription("Provide an ItemID, WoWHead Link, or Item Name")
            .setRequired(true)
        ),
    run: async (interaction) => {
        await interaction.deferReply();
        const { user } = interaction;
        if(!interaction.isChatInputCommand()) return
        const text = interaction.options.getString("item", true);
        const item = await GetAuctionHouseData(text)
        if (item === null) {
            await interaction.editReply(`Could not find item with \'${text}\', please try again.`)
            return;
        }
        let embed = BuildAHEmbed(item)
        

        await interaction.editReply({ embeds: [embed]})
    },
}

const Emoji_R1: string = '<:R1:1082850436953952467>'
const Emoji_R2: string = '<:R2:1082850434265391114>'
const Emoji_R3: string = '<:R3:1082850436136054914>'

const Emoji_R4: string = '<:R4:1082833804634357790>'
const Emoji_R5: string = '<:R5:1082833805544525974>'
const Emoji_Hammer: string = '<:Craft:1082852611268563058>'
const Emoji_GoldCoin: string = '<:Coin:1082823820475375676>'
const Emoji_SilverCoin: string = '<:CoinSilver:1082855901150580786>'
const Emoji_CopperCoin: string = '<:CoinCopper:1082855899674185778>'
const Emoji_Ingot: string = '<:Ignot:1082823818952855562>'
const Emoji_Tree: string = '<:Tree:1082823822325067786>'
const Emoji_Food: string = '<:Food:1082823817782644796>'
const Emoji_Time: string = '<:Time:1082823815710650379>'

function BuildAHEmbed(Item: ItemData): EmbedBuilder {
    // console.log(Item)
    //Create Embed with Minimum Requirements
    const Embed = new EmbedBuilder()
    .setTitle(`${Item.Name}`)
    .setURL(`https://www.wowhead.com/item=${Item.ID}`)
    .setTimestamp()
    .setColor(QualityToColor(Item.Quality))
    
    
    if (Item.Icon != null)  Embed.setThumbnail(Item.Icon)

    

    //Price Builder
    let desc: string = "";
    if (Item.R1Price != null && Item.R2Price != null && Item.R3Price != null) {
        desc += `${Emoji_R1} Auction:\t${ToWoWGold(Item.R1Price)}`
        desc += `\n${Emoji_R2} Auction:\t${ToWoWGold(Item.R2Price)}`
        desc += `\n${Emoji_R3} Auction:\t${ToWoWGold(Item.R3Price)}`
    } else {
        if (Item.Price != null && Item.Price > 0) desc += `${Emoji_GoldCoin} Auction:\t${ToWoWGold(Item.Price)}`
    }

    if (Item.Total != null) {
        if (desc.length > 1) desc += '\n'   
        desc += `${Emoji_Hammer} Crafted:\t${ToWoWGold(Item.Total)}`
    }
    if (Item.Description != null) {
        if (desc.length > 1) desc += '\n'
        Embed.setDescription(Item.Description)
    }
    if (desc.length > 1) Embed.setDescription( desc );

    if (Item.Materials != null) {
        Embed.addFields( { name: " ", value: ` `})
        Embed.addFields( { name: `${Emoji_Ingot} Materials ${Emoji_Ingot}`, value: ` `})
        for (const Material of Item.Materials) {
            Embed.addFields({ name: ` `, value: `${ Material.Amount}x [__**${Material.Name}**__](https://www.wowhead.com/item=${Material.ID})\n>>> ${Emoji_SilverCoin} Unit: ${ToWoWGold(Material.Price)}\n${Emoji_GoldCoin} Total: ${ToWoWGold(Material.Price * Material.Amount)}`})
        }
    }


    //Footer Builder
    let minutesago = Math.floor(Math.floor((Date.now() - Item.DataAge)/1000)/60)
    let footer: string = `Auction House Data was pulled: ${minutesago}m ago.`;
    if (Item.Credit != null) footer += `\nRecipe Added by ${Item.Credit}`
    Embed.setFooter( { text: footer} )
    return Embed
}

function QualityToColor(Quality: any): ColorResolvable {
    switch (Quality) {
        case 'Poor':
            return "Grey"
        case 'Common':
            return "White"
        case 'Uncommon':
            return "Green"
        case 'Rare':
            return "Blue"
        case 'Epic':
            return "Purple"
        case 'Legendary':
            return "Orange"
        default:
            return "White"
    }
}

function ToWoWGold(price: number, clip: boolean = false):string {
	let copper: number = price % 100
	price = (price - copper) / 100
	let silver: number = price % 100
	let gold: number = (price - silver) / 100
    let amount = "";
    if (clip) {
        if (gold > 0) amount += `${gold.toLocaleString("en-US")}g `
        if (silver > 0) amount += `${silver}s `
        if (copper > 0) amount += `${copper}c`
        // console.log(`[Cash] ${amount}`)
    } else {
        amount = `${gold.toLocaleString("en-US")}g ${silver}s ${copper}c`
    }
	return amount.trim()
}