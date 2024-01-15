import "dotenv/config";
import type { Entity } from "prismarine-entity";
import type { Block } from "prismarine-block";
import type { Bot } from "mineflayer";
import { createBot } from "mineflayer";
import { readFile } from "fs/promises";
import IClient, { DiscOptions } from "./discord.js";

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

class PogTownGuard {
    public bot: Bot
    public badBlocks = ["wither_skeleton_skull", "soul_sand", "tnt"]
    public ignoreBlocks = ["air", "dirt", "grass block", "grass_block"]
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
            version: "1.20.1"
        })
        this.bot.on("entitySpawn", this.entitySpawn.bind(this));
        this.bot.on("spawn", this.onSpawn.bind(this));
        this.bot.on("blockUpdate", this.onBlockUpdate.bind(this));
        this.bot.on("physicsTick", async () => {
            ticks++
            //we want to send the messages in an embed if queue is at 10 or 10 seconds have passed
            if (queuedActions.length > 10 || ticks == 200) {
                if (queuedActions.length === 0) return;
                dclient.chatEmbed(queuedActions.join("\n"), "yellow");
                //clear queued actions
                queuedActions.length = 0;
                ticks=0;
            }

        })
    }

    onSpawn(this: this) {
        dclient.chatEmbed("**Furia has logged in.**", "green")
        this.bot.setControlState("sneak", true);
        console.log(this.bot.entity.position);
    }


    blockBrokenEvent(this: this, block: Block, username: string) {

    }

    onBlockUpdate(this: this, old: Block | null, newBlock: Block) {

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
        const nearbyPlayers = playersInRender.filter(player => player.position.distanceTo(placed_block_positon) < 5);
        if (!nearbyPlayers[0]) return;

        //check if they have the item in their hand
        const nearbyPlayersWithItem = nearbyPlayers.filter(player => player.heldItem?.displayName === placed_block_displayName);
        const playerWhoPlaced = nearbyPlayersWithItem[0];


        //This means a block was broken and not placed
        if (newBlock.name === "air" && old?.name !== "air" && nearbyPlayers[0]) {
            if (playerWhoPlaced) {
                queuedActions.push(`**[BROKEN BLOCK]** **${playerWhoPlaced.username}** broke \`${old?.displayName}\` at \`x: ${x} y: ${y} z: ${z}\``);
                return;
            }
            if (nearbyPlayers[0]) {
                queuedActions.push(`**[BROKEN BLOCK]** **${nearbyPlayers[0].username}** most likely broke \`${old?.displayName}\` at \`x: ${x} y: ${y} z: ${z}\``);
               // dclient.chatEmbed(`**[BROKEN BLOCK]** **${nearbyPlayers[0].username}** most likely broke \`${old?.displayName}\` at \`x: ${x} y: ${y} z: ${z}\``, "yellow");
                return;
            }
        }

        if (playerWhoPlaced) {
            queuedActions.push(`**[PLACED BLOCK]** **${playerWhoPlaced.username}** placed \`${newBlock.displayName}\` at \`x: ${x} y: ${y} z: ${z}\``);
            //  dclient.chatEmbed(`**[PLACED BLOCK]** **${playerWhoPlaced.username}** placed \`${newBlock.displayName}\` at \`x: ${x} y: ${y} z: ${z}\``, "yellow");
            return;
        }

        //so if the player did not have block in hand, assume player closest to block placed it
        const closestPlayer = nearbyPlayers[0];
        if (closestPlayer) {
            queuedActions.push(`**[PLACED BLOCK]** **${closestPlayer.username}** most likely placed \`${newBlock.displayName}\` at \`x: ${x} y: ${y} z: ${z}\``);
            //   dclient.chatEmbed(`**[PLACED BLOCK]** **${closestPlayer.username}** most likely placed \`${newBlock.displayName}\` at \`x: ${x} y: ${y} z: ${z}\``, "yellow");
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
             //   this.bot.chat("/msg " + username + " Hello, " + username  + "!")
                return
            }

            dclient.chatEmbed(`unknown user **${username}** has just been spotted at the group base!`, "yellow")

            setTimeout(() => {
                this.lastSeenCoolDown.delete(username);
            }, 25 * 60000);
            return;
        }

        return;
    }

}

new PogTownGuard();