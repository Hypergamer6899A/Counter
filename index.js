// index.js
const { Client, GatewayIntentBits } = require("discord.js");
require("dotenv").config();
const express = require("express");

// --- Discord Client ---
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// --- Config ---
const COUNTING_CHANNEL_ID = process.env.COUNTING_CHANNEL_ID;
const STRIKE_ROLE_ID = "1430958884033658962";
const BAN_ROLE_ID = "1430958965558349995";

// --- Variables ---
let lastNumber = 0;
let lastUserId = null;

// --- On Ready ---
client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// --- Message Handler ---
client.on("messageCreate", async (message) => {
  if (message.author.bot) return; // Ignore bots
  if (message.channel.id !== COUNTING_CHANNEL_ID) return; // Only in counting channel

  const content = message.content.trim();

  // Check if the message is a valid number
  const number = parseInt(content);
  if (isNaN(number)) return; // ignore non-numbers

  const expectedNumber = lastNumber + 1;

  // Check for double count or wrong number
  if (message.author.id === lastUserId || number !== expectedNumber) {
    await message.channel.send(
      `❌ Count reset! <@${message.author.id}> messed it up! Back to **1**.`
    );

    // Assign roles
    try {
      const member = await message.guild.members.fetch(message.author.id);

      if (member.roles.cache.has(STRIKE_ROLE_ID)) {
        // Already has strike, give ban role
        if (!member.roles.cache.has(BAN_ROLE_ID)) {
          await member.roles.add(BAN_ROLE_ID);
          await message.channel.send(
            `🚫 <@${member.id}> has been banned from counting!`
          );
        }
      } else {
        // Give first strike
        await member.roles.add(STRIKE_ROLE_ID);
        await message.channel.send(
          `⚠️ <@${member.id}> received a strike! One more and you're out.`
        );
      }
    } catch (err) {
      console.error("Role assignment error:", err);
    }

    // Reset the count
    lastNumber = 0;
    lastUserId = null;
    return;
  }

  // Valid count
  lastNumber = number;
  lastUserId = message.author.id;

  await message.react("✅");
});

// --- Bot Login ---
client.login(process.env.TOKEN).catch((err) => {
  console.error("❌ Failed to login:", err);
});

// --- Express for Render Keepalive ---
const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => res.send("Counting bot is running!"));
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    bot: client.user ? client.user.tag : "starting",
    lastNumber,
    lastUserId,
    time: new Date().toISOString(),
  });
});

app.listen(PORT, () =>
  console.log(`🌐 Web server listening on port ${PORT} (pid=${process.pid})`)
);
