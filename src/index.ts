import "dotenv/config";
import type { Entity } from "prismarine-entity";
import type { Block } from "prismarine-block";
import type { Bot } from "mineflayer";
import { createBot } from "mineflayer";
import { readFile } from "fs/promises";
import IClient, { DiscOptions } from "./discord.js";
import type { Vec3 } from "vec3";
export const dclient = new IClient(new DiscOptions());

const queuedActions: string[] = [];

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

let ticks: number = 0;

//username as string, position and block details.

//Dont report same block twice!
const detectedBlockSet: Set<Vec3> = new Set();

const detectedBlockUpdatesMap: Map<string, {
    position: Vec3,
    block_name: string,
}> = new Map();

class PogTownGuard {
    public bot: Bot
    public badBlocks = ["wither_skeleton_skull", "soul_sand", "tnt"]
    public ignoreBlocks = ["dirt", "grass block", "grass_block"]
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
            version: "1.20"
        })
        this.bot.on("entitySpawn", this.entitySpawn.bind(this));
        this.bot.on("spawn", this.onSpawn.bind(this));
        this.bot._client.on("block_break_animation", console.log)

        this.bot.on("blockUpdate", this.onBlockUpdate.bind(this));
    }

    onSpawn(this: this) {
        dclient.chatEmbed("**Furia has logged in.**", "green")
        this.bot.setControlState("sneak", true);
        console.log(this.bot.entity.position);

        setInterval(() => {
            if (queuedActions.length > 0) {
                dclient.RegularMessage(queuedActions.map(action => action).join("\n"));
                queuedActions.length = 0;
            }
        }, 1000);

    }


    blockBrokenEvent(this: this, block: Block, username: string) {

    }

    checkIfPlayerInRangeOfBlock(players: Entity[], block: Block, range:number) {
        const nearbyPlayers = players.filter(player => player.position.distanceTo(block.position) < range);
        return nearbyPlayers;
    };

    async onBlockUpdate(this: this, old: Block | null, newBlock: Block) {
         
        // if (detectedBlockSet.has(newBlock.position)) return;
        // if (detectedBlockSet.has(old?.position as Vec3)) return;

        // detectedBlockSet.add(old?.position as Vec3);
        // detectedBlockSet.add(newBlock.position);

        if (this.ignoreBlocks.includes(newBlock.name)) return;
        if (old && old?.name && this.ignoreBlocks.includes(old?.name)) return

        //Getting the position of the newBlock
        const placed_block_positon = newBlock.position;
        const { x, y, z } = placed_block_positon

        //Geting displayName of new block
        const placed_block_displayName = newBlock.displayName;

        //Geting all entities within render distance
        const entitiesInRender = this.bot.entities;

        //filter entites for players only
        const playersInRender = Object.values(entitiesInRender).filter(entity => entity.type === "player");

        //check if player is within 5 blocks of placed or broken block
        const nearbyPlayers = this.checkIfPlayerInRangeOfBlock(playersInRender, newBlock, 3.5);
        if (!nearbyPlayers[0]) return;

        //check if they have the item in their hand
        const nearbyPlayersWithItem = nearbyPlayers.filter(player => player.heldItem?.displayName === placed_block_displayName);
        const playerWhoPlaced = nearbyPlayersWithItem[0];

        if (
            newBlock.name === "air" &&
            old?.name !== "air" &&
            nearbyPlayers[0]
        ) {
            queuedActions.push(`\`[BROKEN BLOCK]\` **${nearbyPlayers[0].username}** most likely broke \`${old?.displayName}\` at \`x: ${x} y: ${y} z: ${z}\``);
            return
            
        }

        if (playerWhoPlaced) {
            queuedActions.push(`\`[PLACED BLOCK]\` **${playerWhoPlaced.username}** placed \`${newBlock.displayName}\` at \`x: ${x} y: ${y} z: ${z}\``);
            return;
        }

    }


    entitySpawn(this: this, entity: Entity): void {
        
        if (entity.name === "wither") {
            dclient.chatEmbed(`A wither has been spotted at the base!!!!`, "red")
            return;
        }

        if (entity.type === "player") {
            const username = entity.username as string;
            if (username === this.bot.username) return;
            if (this.lastSeenCoolDown.has(username)) return;
            this.lastSeenCoolDown.add(username);
            if (dclient.mcWhitelist.includes(username)) {
                dclient.chatEmbed(`trusted member, **${username}** has just been spotted at the group base`, "green");
             //   this.bot.chat("/msg " + username + " Welcome back, " + username  + "!")
                return
            }

            const trustedDiscordIDS = dclient.allowedIDS;
            const trustedDiscordIDSString = trustedDiscordIDS.map(id => `<@${id}>`).join(" ");

            dclient.chatEmbed(`unknown user **${username}** has just been spotted at the group base! ${trustedDiscordIDSString}`, "yellow")
            this.bot.chat(`uhhhh wyd ${username}??`)
            setTimeout(() => {
                this.lastSeenCoolDown.delete(username);
            }, 25 * 60000);
            return;
        }

        return;
    }

}

new PogTownGuard();