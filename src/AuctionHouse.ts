import sqlite3 from 'sqlite3';
import fs from 'fs';
import { ItemData, Material } from './interfaces/AuctionHouseData.js';
import { Get, DownloadAH } from './WoWAPI.js';
import { CronJob } from 'cron';
import { json } from 'stream/consumers';
    
let Database = new sqlite3.Database('./data/Recipes.db', (err) => {
    if (err) return console.error(err.message);
    console.log('Connected to ItemData Database.');
});

// Everyhour: '1 0-23 * * *',
// Every Minute:
var job = new CronJob(
	'30 0-23 * * *',
	async function() {
		console.warn('Downloading Latest Commotities.');
        let check = await DownloadAH()
        if (check != null) {
            ahjson = check
        }
	},
	null,
	true,
);

let ahjson = JSON.parse(fs.readFileSync("./data/commodities.json", 'utf8'))

//Exposed function that is called from the Discord Command
//Validate Input is correct first so we don't have to worry about it later.
export const GetAuctionHouseData = async (Input: string) => {
    let Item = await ValidateInput(Input);
    if (Item.ID == -1) {
        console.error(`Cannot find Item: ${Input}.`)
        return null;
    }
    console.log(`[Found] [${Item.Name}:${Item.ID}]`)
    return ItemBuilder(Item.ID);
}

async function ValidateInput(Input:string) {
    //TODO Check WoWAPI as fallback if Item Exists
    let Item = { ID: -1, Name: ""}
    let Matches = Input.match(/\d+/g);

    //Found ID or WoWHead URL, else It's an Item Name.
    if (Matches) {
        //Get first Regex Match, then check if the Database has Said Item
        //If Data is found, assign to Item properties, and return
        let ID = parseInt(Matches[0])
        let Name = await GetDataFromDB(`select * from ItemIDs where Rank1 = ${ID} or Rank2 = ${ID} or Rank3 = ${ID}`)
        if (Name != null) {
            Item.ID = ID;
            Item.Name = Name;
            return Item;
        }
    } else {
        let Name = Input
        let ID = await GetItemID(Input)
        if (ID != null) {
            Item.ID = ID;
            Item.Name = Name;
            return Item;
        }
    }

    //Returns -1, thus nothing was found.
    return Item
}

async function GetDataFromDB(query: string): Promise<any> {
    try {
        return new Promise((resolve, reject) => {
            Database.get(query, (err:any, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });
    } catch (error: any) {
        console.error(error.message)
        return null
    }
}
async function ItemBuilder(ID: number): Promise<ItemData> {
    let Item: ItemData = {
        ID: -1,
        Name: "",
    };
    let iData = await GetItemData(ID);
    if (iData.ID != null) Item.ID = iData.ID;
    if (iData.Name != null) Item.Name = iData.Name;
    if (iData.Description != null) Item.Description = iData.Description;
    if (iData.Icon != null) Item.Icon = iData.Icon
    if (iData.Quality != null) Item.Quality = iData.Quality;
    if (iData.PurchasedPrice != null) Item.PurchasedPrice = iData.PurchasedPrice;

    let Price = GetItemPrice(Item.ID)
    if (Price != 0) Item.Price = Price

    let rData = await GetRecipeData(Item.Name)
    if (rData != null) {
        if (rData.Crafted != null) Item.Crafted = rData.Crafted
        if (rData.Credit != null) Item.Credit = rData.Credit
        Item.Materials = []
        let total: number = 0;
        for (let i = 1; i < 8; i++) {
            if (rData[`M${i}`] == null) continue; 
            let id: number = await GetItemID(rData[`M${i}`]);
            let data: Material = {
                ID: id,
                Name: rData[`M${i}`],
                Price: GetItemPrice(id),
                Amount: rData[`M${i}A`],
            }
            total += (data.Price * data.Amount);
            Item.Materials.push(data);
        }
        Item.Total = total;
    }
    return Item
}


async function GetRecipeData(Name: string): Promise<any> {
    let rData = await GetDataFromDB(`SELECT * from Recipes where Name = \"${Name}\" COLLATE NOCASE`)
    if (rData != null || rData != undefined) return rData;
    return null;
}

// Handler for WoW's Ability to have different rank of items.
// Materials in WoW, can have up to three ranks, each has a different item id per rank.
// Don't have to worry about this on eqiuipable gear, as rank just scales the item's level.
// Unless we demand a special rank, we default to returning Rank 3 as it's the most commonly used.
async function GetItemID(text: string, Rank: number = -1): Promise<number> {
    let sql = `SELECT * FROM ItemIDs WHERE Name = \"${text}\" COLLATE NOCASE`;
    let IDs: any = -1
    try {
        let IDs: any = await GetDataFromDB(sql)
        if (Rank == -1) {
            if (IDs.Rank3 != null) return IDs.Rank3
            if (IDs.Rank2 != null) return IDs.Rank2
            if (IDs.Rank1 != null) return IDs.Rank1
        } else {
            if (Rank == 3 && IDs.Rank3 != null) return IDs.Rank3
            if (Rank == 2 && IDs.Rank2 != null) return IDs.Rank2
            if (Rank == 1 && IDs.Rank1 != null) return IDs.Rank1 
        }
    } catch (error) {
        return -1
    }
    return -1
}

async function GetItemData(ID:number) {
    let Data = await GetDataFromDB(`SELECT * FROM ItemData WHERE ID = ${ID}`);
    if (Data == null) {
        let i = await Get(`https://us.api.blizzard.com/data/wow/item/${ID}?namespace=static-us&locale=en_US`)
        let p = await Get(`https://us.api.blizzard.com/data/wow/media/item/${ID}?namespace=static-us&locale=en_US`) 
        if (i == null || p == null) {
            console.error(`[ItemData] API returned no results.`)
            return null;
        }
        Database.run('INSERT INTO ItemData(ID, Name, Description, Quality, Class, Subclass, InventoryType, PurchasePrice, SellPrice, Icon) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', 
                    [i.id, i.name, i.description, i.quality.name, i.item_class.name, i.item_subclass.name, i.inventory_type.name, i.purchase_price, i.sell_price, p.assets[0].value], (err) => {
                        if (err) return console.log(err.message);
                        console.log(`[Database] Inserted Row into ItemData : (${i.id}, ${i.name})`);
                    });
        Data = await GetDataFromDB(`SELECT * FROM ItemData WHERE ID = ${ID}`);
    }
    return Data
}

async function GetIcon(ID: number): Promise<string> {
    let Icon = await GetDataFromDB(`SELECT * FROM Icons WHERE ID = ${ID}`);
    if (Icon != null) return Icon.URL;
    let API = await Get(`https://us.api.blizzard.com/data/wow/media/item/${ID}?namespace=static-us&locale=en_US`)
    // console.log(API);
    if (API != null) {
        let IconURL: string = API.assets[0].value
        Database.run('INSERT INTO Icons(ID, URL) VALUES(?, ?)', [ID, IconURL], (err) => {
            if (err) return console.log(err.message);
            console.log(`A row has been inserted Icons: (${ID}, ${IconURL})`);
        });
        return IconURL
    }
    return ""
}

// Loops through the Commodities.json to find the lowest price avaliable.
// Luckily Blizzard stores the last entries with the cheapest price.
// TODO Figure out If Item is a Commodity or Not, then search a specific Auction House Data.
function GetItemPrice(id: number):number {
    let price: number = 0;
    for (let i = 0; i < ahjson.auctions.length; i++) {
        if (ahjson.auctions[i].item.id == id) {
            if (price == 0 || ahjson.auctions[i].unit_price < price) {
                price = ahjson.auctions[i].unit_price
            }
        }
    }
    return price
}