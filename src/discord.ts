import { Client, Partials, ClientOptions, GatewayIntentBits, TextChannel, ChannelType } from "discord.js";
import { config } from "./index.js";
import { log } from "./utils/log.js";
import { writeFile, readFile } from "fs/promises"

//https://discord.com/api/oauth2/authorize?client_id=1080685008739631135&permissions=2048&scope=bot
export class DiscOptions implements ClientOptions {
    token = process.env.TOKEN
    partials: Partials[] = [Partials.Message, Partials.Channel]
    intents = [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessages,
    ]
}

type Channels = {
    channel_id: string,
    setup_by: string,
    time: number
}

const colors = {
    red: 15548997,
    blue: 3447003,
    grey: 9807270,
    green: 5763719,
    yellow: 16705372
}

export default class IClient extends Client {

    public Ichannels: Map<string, TextChannel> = new Map();
    public colors = colors;
    public mcWhitelist: string[] = []
    public allowedIDS:string[] = []

    constructor(options: DiscOptions) {
        super(options);

        this.login(options.token);
        this.on("ready", async () => {
            log("Discord bot ready.", "red", true)
            this.loadChannels();
            this.mcWhitelist = await this.loadMcWhitelist()
        })

        this.on("messageCreate", async (message) => {
            const { channelId, content, author, channel } = message;
            if (!this.allowedIDS.includes(author.id)) return
            const cont = content.split(" ");


            // Add channel command.
            if (cont[0].startsWith("!channeladd".toLocaleLowerCase())) {
                const did = await this.addChannel(channel as TextChannel, `${author.username}#${author.discriminator}`);
                if (did) message.reply("channel added. I'll now start to inform you about activity at the group base.")
                return;
            }

            if (cont[0].startsWith("!whitelistadd".toLocaleLowerCase())) {
                const userToAdd = cont[1]; 
                if (!userToAdd) {
                    message.reply("Please specify a user to add to the whitelist. Use the users in-game IGN")
                    return;
                }

                this.mcWhitelist = await this.addMcWhitelist(userToAdd);
                message.reply(`Successfully added **${userToAdd}** to the Trusted Member list.`)
                return;

            }

        })
    }

    private async addChannel(channel: TextChannel, addedBy: string) {
        const channelsOBj = await JSON.parse(await readFile("./disc/channels.json", "utf-8"))

        const chanExists = await new Promise(res => {
            if (channelsOBj.channels.some((chan: Channels) => chan.channel_id === channel.id)) {
                res(true);
            } 
            res(false)
        })

        if (chanExists) {
            channel.send("There is already a notification feed in this channel.")
            return false;
        }

        channelsOBj.channels.push({ channel_id: channel.id, setup_by: addedBy, time: Date.now() })
        await writeFile("./disc/channels.json", JSON.stringify(channelsOBj));
        await this.loadChannels();
        return true
    }

    private async loadChannels() {
        const channels: Channels[] = (await JSON.parse(await readFile("./disc/channels.json", "utf-8"))).channels;
        for (const channel of channels) {
            this.Ichannels.set(channel.channel_id, this.channels.cache.get(channel.channel_id) as TextChannel)
        }

        for (const [key, _] of this.Ichannels) {
            if (!channels.some(chan => chan.channel_id === key)) {
                this.Ichannels.delete(key);
            }
        }

        return;
    }

    private async loadMcWhitelist(): Promise<string[]> {
        const whitelist = (await JSON.parse(await readFile("./mc/whitelist.json", "utf-8"))).whitelist;
        this.allowedIDS = (await JSON.parse(await readFile("./disc/whitelist.json", "utf-8"))).whitelist;
        return whitelist;
    }

    private async addMcWhitelist(username: string) {
        const userObj = await JSON.parse(await readFile("./mc/whitelist.json", "utf-8"))
        userObj.whitelist.push(username);
        await writeFile("./mc/whitelist.json", JSON.stringify(userObj));
        const whitelist = await this.loadMcWhitelist();
        return whitelist;
    }

    public async chatEmbed(text: string, color: "red"|"green"|"blue"|"grey"|"yellow") {
        const numColor = this.colors[color] as number;

        for (const [_, channel] of this.Ichannels) {
            if (!channel) return;
            try {
                await channel.send({
                    embeds: [{
                        color: numColor,
                        description: text
                    }]
                })
            } catch (err) {
                console.log(err, " Sending chat embed error.")
                return;
            }
        }
    }

    public async RegularMessage(text: string) { 
        for (const [_, channel] of this.Ichannels) {
            if (!channel) return;
            try {
                await channel.send(text)
            } catch (err) {
                console.log(err, " Sending regular message error.")
                return;
            }
        }
    }


}