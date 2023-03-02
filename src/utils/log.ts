import chalk from "chalk";

import { dclient } from "../index.js";

function log(text: string, color: any, useDiscord?: boolean) {
    if (useDiscord) dclient.chatEmbed(text, color);

    //@ts-ignore;
    console.log(chalk[color](text));
}


export { log };