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
  if (message.author.bot) return;
  if (message.channel.id !== COUNTING_CHANNEL_ID) return;

  const number = parseInt(message.content.trim());
  if (isNaN(number)) return; // ignore non-numbers

  const expected = lastNumber + 1;

  // Invalid count
  if (number !== expected || message.author.id === lastUserId) {
    await message.channel.send(
      `❌ Count reset! <@${message.author.id}> messed it up! Back to **1**.`
    );

    try {
      const member = await message.guild.members.fetch(message.author.id);

      if (member.roles.cache.has(STRIKE_ROLE_ID)) {
        // Already warned once — ban them from counting
        if (!member.roles.cache.has(BAN_ROLE_ID)) {
          await member.roles.add(BAN_ROLE_ID);
          await message.channel.send(
            `🚫 <@${member.id}> has been banned from counting!`
          );
        }
      } else {
        // First offense — give strike
        await member.roles.add(STRIKE_ROLE_ID);
        await message.channel.send(
          `⚠️ <@${member.id}> received a strike! One more and you're out.`
        );
      }
    } catch (err) {
      console.error("Role assignment error:", err);
    }

    // Reset count cleanly
    lastNumber = 0;
    lastUserId = null;
    return;
  }

  // ✅ Valid count
  lastNumber = number;
  lastUserId = message.author.id;

// Update bot's custom status to show current count
client.user.setPresence({
  activities: [
    { name: `Counting, rn at ${lastNumber}`, type: 3 } // 3 = Watching
  ],
  status: "online"
});
  
  await message.react("✅");

  // Optional: Show current number milestone
  if (number % 50 === 0) {
    await message.channel.send(`🎉 Nice! The count reached **${number}**!`);
  }
});

// --- Bot Login ---
client.login(process.env.TOKEN).catch((err) => {
  console.error("❌ Failed to login:", err);
});

// --- Express Keepalive for Render ---
const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => res.send("Counting bot is running!"));
app.get("/health", (req, res) =>
  res.json({
    status: "ok",
    bot: client.user ? client.user.tag : "starting",
    lastNumber,
    lastUserId,
    time: new Date().toISOString(),
  })
);

app.listen(PORT, () =>
  console.log(`🌐 Web server listening on port ${PORT} (pid=${process.pid})`)
);
