export interface ItemData {
    ID: number,
    Name: string,
    Description?: string,
    Icon?: string,
    Quality?: string,
    Class?: string,
    Subclass?: string,
    Price?: number,
    PurchasedPrice?: number,
    Crafted?: any,
    Credit?: string,
    Total?: number,
    Materials?: Material[]
}

export type Material = {
    ID: number,
    Name: string,
    Price: number,
    Amount: number,
}