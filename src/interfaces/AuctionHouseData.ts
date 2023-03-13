export interface ItemData {
    ID: number,
    Name: string,
    Description?: string,
    Icon?: string,
    Quality?: string,
    Price?: number,
    R1Price?: number,
    R2Price?: number,
    R3Price?: number,
    PurchasedPrice?: number,
    Crafted?: any,
    Credit?: string,
    Total?: number,
    Materials?: Material[]
    DataAge: number
}

export type Material = {
    ID: number,
    Name: string,
    Price: number,
    Amount: number,
}