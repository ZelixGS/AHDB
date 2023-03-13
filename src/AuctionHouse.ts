import sqlite3 from 'sqlite3';
import fs from 'fs';
import { ItemData, Material } from './interfaces/AuctionHouseData.js';
import { Get, DownloadAH } from './WoWAPI.js';
import { CronJob } from 'cron';
    
// TODO:
// [ ] Prevent potential SQLInjections
// [ ] Alias - Sophic Devotion -> Enchant Weapon - Sophic Devotion, Feasts, Cringebark
// [X] Item with Ranks return Ranks 1-3 price from AH (Excluding Materials)
// [ ] Items with Multiple Recipes (Feasts)
// [X] Add Data Age in Footer (Data was pulled 39 Minutes Ago)
// [X] Reformat Discord Print Out Again (Still not Super Clear)
// [X] Custom Emoji Support? For GoldSilverCopper, and Rank1-3
// [ ] Also API fall back


const DB = new sqlite3.Database('./data/Recipes.db', (err) => {
    if (err) return console.error(err.message);
    console.log('Connected to ItemData Database.');
});

// CronJob to get fetch latest Commodities Database from Blizzard.
// Occurs every once an hour, on the half hour.
const GetLatestCommodities = new CronJob(
	'32 0-23 * * *',
	async function() {
		console.warn('Downloading Latest Commotities.');
        let check = await DownloadAH()
        if (check != null) {
            Commodities = check
            CommoditiesLastPull = Date.now()
        }
	},
	null,
	true,
);

let Commodities = JSON.parse(fs.readFileSync("./data/commodities.json", 'utf8'))
let CommoditiesLastPull: number = fs.statSync("./data/commodities.json").mtimeMs;

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
        let Name = await GetDataFromDB(`select * from ItemIDs where R1 = ${ID} or R2 = ${ID} or R3 = ${ID}`)
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

async function ItemBuilder(ID: number, SearchByName: boolean = false): Promise<ItemData> {
    let Item: ItemData = {
        ID: -1,
        Name: "",
        DataAge: CommoditiesLastPull
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

    let Rank1 = await GetItemID(Item.Name, 1)
    let Rank2 = await GetItemID(Item.Name, 2)
    let Rank3 = await GetItemID(Item.Name, 3)
    if (Rank1 != -1) Item.R1Price = GetItemPrice(Rank1)
    if (Rank2 != -1) Item.R2Price = GetItemPrice(Rank2)
    if (Rank3 != -1) Item.R3Price = GetItemPrice(Rank3)


    let Recipes = await GetRecipes(Item.Name)
    if (Recipes.length == 0) return Item
    for (const Recipe of Recipes) {
        Item.Crafted = Recipe.Crafted
        Item.Credit = Recipe.Credit
        Item.Materials = []
        let total: number = 0;
        for (let i = 1; i < 9; i++) {
            if (Recipe[`M${i}`] == null) continue; 
            let id: number = await GetItemID(Recipe[`M${i}`]);
            let data: Material = {
                ID: id,
                Name: Recipe[`M${i}`],
                Price: GetItemPrice(id),
                Amount: Recipe[`M${i}A`],
            }
            total += (data.Price * data.Amount);
            Item.Materials.push(data);
        }
        Item.Total = total;
    }
    return Item
}


// Returns All Rows found by Select from the Recipes Table
// Certain Items have multiple Recipes, such as Grand Banquet of the Kalu'ak.
async function GetRecipes(Name: string): Promise<Array<any>> {
    return new Promise((resolve, reject) => {
        DB.all(`SELECT * FROM Recipes WHERE Name = ? COLLATE NOCASE`, Name, (err, rows) => {
            if (err) {
                console.log(`[GetRecipes] ${err}`)
                reject(err);
            }
            resolve(rows);
        });
    });
}



// Handler for WoW's Ability to have different rank of items.
// Materials in WoW, can have up to three ranks, each has a different item id per rank.
// Don't have to worry about this on eqiuipable gear, as rank just scales the item's level.
// Unless we demand a special rank, we default to returning Rank 3 as it's the most commonly used.
async function GetItemID(Input: string, Rank: number = -1): Promise<number> {
    let Result = await GetDataFromDB(`SELECT * FROM ItemIDs WHERE Name = \"${Input}\" COLLATE NOCASE`)
    if (Result != null) {
        if (Rank == -1) {
            if (Result.R3 != null) return Result.R3
            if (Result.R2 != null) return Result.R2
            if (Result.R1 != null) return Result.R1
        } else {
            if (Rank == 3 && Result.R3 != null) return Result.R3
            if (Rank == 2 && Result.R2 != null) return Result.R2
            if (Rank == 1 && Result.R1 != null) return Result.R1 
        }
    }
    console.log(`[GetItemID][${Input}] Database did not get any results.`)
    return -1;
}

async function GetDataFromDB(query: string): Promise<any> {
    return new Promise((resolve, reject) => {
        DB.get(query, (err:any, row) => {
            if (err) {
                console.log(`[${err}] ${query}`)
                reject(err);
            }
            resolve(row);
         });
    });
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
        DB.run('INSERT INTO ItemData(ID, Name, Description, Quality, Class, Subclass, InventoryType, PurchasePrice, SellPrice, Icon) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', 
                    [i.id, i.name, i.description, i.quality.name, i.item_class.name, i.item_subclass.name, i.inventory_type.name, i.purchase_price, i.sell_price, p.assets[0].value], (err) => {
                        if (err) return console.log(err.message);
                        console.log(`[Database] Inserted Row into ItemData : (${i.id}, ${i.name})`);
                    });
        Data = await GetDataFromDB(`SELECT * FROM ItemData WHERE ID = ${ID}`);
    }
    return Data
}

// Loops through the Commodities.json to find the lowest price avaliable.
// Luckily Blizzard stores the last entries with the cheapest price.
// TODO Figure out If Item is a Commodity or Not, then search a specific Auction House Data.
function GetItemPrice(id: number):number {
    let price: number = 0;
    for (let i = 0; i < Commodities.auctions.length; i++) {
        if (Commodities.auctions[i].item.id == id) {
            if (price == 0 || Commodities.auctions[i].unit_price < price) {
                price = Commodities.auctions[i].unit_price
            }
        }
    }
    return price
}