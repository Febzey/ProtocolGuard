import "dotenv/config";
import type { Entity } from "prismarine-entity";
import type { Block } from "prismarine-block";
import type { Bot } from "mineflayer";
import { createBot } from "mineflayer";
import { readFile } from "fs/promises";
import IClient, { DiscOptions } from "./discord.js";

export const dclient = new IClient(new DiscOptions());

interface BlockCounts {
    [key: string]: {
        count: number;
        timeoutId?: NodeJS.Timeout;
    };
}

type Config = {
    host: string,
    port: number
}

export const config = await JSON.parse(await readFile("./config.json", "utf-8")) as Config;

class PogTownGuard {
    public bot: Bot
    public whitelist = ["Furia"];
    public badBlocks = ["wither_skeleton_skull", "soul_sand", "tnt"]
    private blockCounts: BlockCounts = {};
    private lastSeenCoolDown: Set<string>;

    constructor() {
        this.lastSeenCoolDown = new Set();

        this.bot = createBot({
            host: config.host,
            port: config.port,
            username: process.env.USER as string,
            auth: "microsoft",
            viewDistance: "far",
        })
        this.bot.on("entitySpawn", this.entitySpawn.bind(this));
        this.bot.on("spawn", this.onSpawn.bind(this));

        this.bot.on("blockUpdate", this.onBlockUpdate.bind(this));
    }

    onSpawn(this: this) {
        dclient.chatEmbed("**PogTownGuard has logged in.**", "green")
        this.bot.setControlState("sneak", true);
    }

    onBlockUpdate(this: this, old: Block | null, newBlock: Block) {
        if (!this.badBlocks.includes(newBlock.name)) return;
        const blockCount = this.blockCounts[newBlock.name] || { count: 0 };
        blockCount.count += 1;
        clearTimeout(blockCount.timeoutId);
        blockCount.timeoutId = setTimeout(() => {
            dclient.chatEmbed(`**${newBlock.displayName}** placed ${blockCount.count}x at PogTown!`, "red");
            blockCount.count = 0;
        }, 5000);
        this.blockCounts[newBlock.name] = blockCount;

        return;
    }


    entitySpawn(this: this, entity: Entity): void {
        if (entity.name === "wither") {
            dclient.chatEmbed(`A wither has been spotted at PogTown!!`, "red")
            return;
        }

        if (entity.type === "player") {
            const username = entity.username as string;
            if (this.lastSeenCoolDown.has(username)) return;
            this.lastSeenCoolDown.add(username);
            if (dclient.mcWhitelist.includes(username)) {
                dclient.chatEmbed(`trusted member, **${username}** has just been spotted at PogTown!`, "green");
                return
            }

            dclient.chatEmbed(`**${username}** has just been spotted at PogTown!`, "yellow")

            setTimeout(() => {
                this.lastSeenCoolDown.delete(username);
            }, 2000);
            return;
        }

        return;
    }

}

new PogTownGuard();