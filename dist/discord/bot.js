"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const fs_1 = __importDefault(require("fs"));
const uuid4_1 = __importDefault(require("uuid4"));
const ApiKey_1 = require("../models/ApiKey");
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const AUTHORIZED_USER_IDS = ((_a = process.env.AUTHORIZED_USER_IDS) === null || _a === void 0 ? void 0 : _a.split(",")) || [];
const client = new discord_js_1.Client({ intents: [discord_js_1.GatewayIntentBits.Guilds, discord_js_1.GatewayIntentBits.GuildMessages, discord_js_1.GatewayIntentBits.MessageContent, discord_js_1.GatewayIntentBits.DirectMessages] });
client.on("ready", () => {
    var _a;
    console.log(`Logged in as ${(_a = client.user) === null || _a === void 0 ? void 0 : _a.tag}`);
});
client.on("messageCreate", async (msg) => {
    if (msg.author.bot)
        return;
    if (!msg.content.startsWith("!genkeys"))
        return;
    if (!AUTHORIZED_USER_IDS.includes(msg.author.id)) {
        msg.reply("You are not authorized to use this command.");
        return;
    }
    // Parse command: !genkeys <count> <role> <daysValid> <endpoints>
    // Example: !genkeys 3 premium 30 /api/data,/api/other
    const args = msg.content.split(" ");
    const count = parseInt(args[1]) || 1;
    const role = args[2] || "free";
    const daysValid = parseInt(args[3]) || 30;
    const endpoints = args[4] ? args[4].split(",") : undefined;
    const keys = [];
    const now = new Date();
    for (let i = 0; i < count; i++) {
        const key = (0, uuid4_1.default)();
        await ApiKey_1.ApiKeyModel.create({
            key,
            role,
            createdAt: now,
            daysValid,
            // expiresAt will be calculated at runtime from first use + daysValid
        });
        keys.push(key);
    }
    // Write keys to txt file
    const filePath = `./genkeys_${Date.now()}.txt`;
    fs_1.default.writeFileSync(filePath, keys.join("\n"));
    const attachment = new discord_js_1.AttachmentBuilder(filePath);
    // Try DM first, fallback to channel
    try {
        await msg.author.send({ content: `Here are your generated keys:`, files: [attachment] });
        msg.reply("Keys sent via DM!");
    }
    catch (_a) {
        if (msg.channel instanceof discord_js_1.TextChannel) {
            await msg.channel.send({ content: `Here are your generated keys:`, files: [attachment] });
        }
        else {
            msg.reply("Could not send keys via DM or channel.");
        }
    }
    fs_1.default.unlinkSync(filePath);
});
client.login(DISCORD_TOKEN);
