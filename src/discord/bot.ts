import { AttachmentBuilder, Client, GatewayIntentBits, Message, TextChannel } from "discord.js";
import fs from "fs";
import uuid4 from "uuid4";
import { ApiKeyModel } from "../models/ApiKey";

const DISCORD_TOKEN = process.env.DISCORD_TOKEN!;
const AUTHORIZED_USER_IDS = process.env.AUTHORIZED_USER_IDS?.split(",") || [];

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.DirectMessages] });

client.on("ready", () => {
  console.log(`Logged in as ${client.user?.tag}`);
});

client.on("messageCreate", async (msg: Message) => {
  if (msg.author.bot) return;
  if (!msg.content.startsWith("!genkeys")) return;
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

  const keys: string[] = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const key = uuid4();
    await ApiKeyModel.create({
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
  fs.writeFileSync(filePath, keys.join("\n"));
  const attachment = new AttachmentBuilder(filePath);

  // Try DM first, fallback to channel
  try {
    await msg.author.send({ content: `Here are your generated keys:`, files: [attachment] });
    msg.reply("Keys sent via DM!");
  } catch {
    if (msg.channel instanceof TextChannel) {
      await msg.channel.send({ content: `Here are your generated keys:`, files: [attachment] });
    } else {
      msg.reply("Could not send keys via DM or channel.");
    }
  }

  fs.unlinkSync(filePath);
});

client.login(DISCORD_TOKEN);
