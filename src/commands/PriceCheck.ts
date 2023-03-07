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

function BuildAHEmbed(Item: ItemData): EmbedBuilder {
    // console.log(Item)
    //Create Embed with Minimum Requirements
    const Embed = new EmbedBuilder()
    .setTitle(`${Item.Name}`)
    .setURL(`https://www.wowhead.com/item=${Item.ID}`)
    .setTimestamp()
    .setColor(QualityToColor(Item.Quality))

    if (Item.Description != null) Embed.setDescription(Item.Description)
    if (Item.Icon != null)  Embed.setThumbnail(Item.Icon)
    if (Item.Credit != null) Embed.setFooter({ text: `Recipe Added by ${Item.Credit}`})

    //Price Builder
    let desc: string = "";
    if (Item.Price != null && Item.Price > 0) desc += `:scales: Auction:\t${ToWoWGold(Item.Price)}`
    if (Item.Total != null) {
        if (desc.length > 1) desc += '\n'   
        desc += `:hammer_pick: Crafted:\t${ToWoWGold(Item.Total)}`
    }
    if (Item.PurchasedPrice != null) {
        if (desc.length > 1) desc += '\n'   
        desc += `:coin: Vendor:\t${ToWoWGold(Item.PurchasedPrice)}`
    }
    if (desc.length > 1) Embed.addFields( { name: ':coin: Prices :coin:', value: desc } );
    
    if (Item.Materials != null) {
        Embed.addFields( { name: " ", value: ` `})
        Embed.addFields( { name: ":scroll: Materials :scroll:", value: ` `})
        for (const Material of Item.Materials) {
            Embed.addFields({ name: ` `, value: `${Material.Amount}x [${Material.Name}](https://www.wowhead.com/item=${Material.ID})\n:scales:: ${ToWoWGold(Material.Price)}\n:money_with_wings:: ${ToWoWGold(Material.Price * Material.Amount)}`})
        }
    }
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