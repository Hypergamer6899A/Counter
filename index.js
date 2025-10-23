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
  // Initialize presence
  client.user.setPresence({
    activities: [{ name: `Counting, rn at ${lastNumber}`, type: 3 }],
    status: "online",
  });
});

// --- Message Handler ---
client.on("messageCreate", async (message) => {
  if (message.author.bot) return; // Ignore bots
  if (message.channel.id !== COUNTING_CHANNEL_ID) return; // Only counting channel

  const number = parseInt(message.content.trim());
  if (isNaN(number)) return; // Ignore non-numbers

  const expected = lastNumber + 1;

  // Invalid count
  if (number !== expected || message.author.id === lastUserId) {
    if (message._countHandled) return; // Prevent double-processing
    message._countHandled = true;

    await message.channel.send(
      `❌ Count reset! <@${message.author.id}> messed it up! Back to **1**.`
    );

    try {
      const member = await message.guild.members.fetch(message.author.id);

      if (member.roles.cache.has(STRIKE_ROLE_ID)) {
        // Already has a strike — ban them from counting
        if (!member.roles.cache.has(BAN_ROLE_ID)) {
          await member.roles.add(BAN_ROLE_ID);
          await message.channel.send(
            `🚫 <@${member.id}> has been banned from counting!`
          );
        }
      } else {
        // First strike
        await member.roles.add(STRIKE_ROLE_ID);
        await message.channel.send(
          `⚠️ <@${member.id}> received a strike! One more and you're out.`
        );
      }
    } catch (err) {
      console.error("Role assignment error:", err);
    }

    // Reset count
    lastNumber = 0;
    lastUserId = null;

    // Update presence
    if (client.user) {
      client.user.setPresence({
        activities: [{ name: `Counting paused`, type: 3 }],
        status: "online",
      });
    }

    return; // Exit early
  }

  // ✅ Valid count
  lastNumber = number;
  lastUserId = message.author.id;

  // Update presence
  if (client.user) {
    client.user.setPresence({
      activities: [{ name: `Counting, rn at ${lastNumber}`, type: 3 }],
      status: "online",
    });
  }

  await message.react("✅");

  // Celebrate milestones
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
