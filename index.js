// index.js
const { Client, GatewayIntentBits } = require("discord.js");
require("dotenv").config();
const express = require("express");
const fs = require("fs");
const path = require("path");

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
const DATA_FILE = path.join(__dirname, "countData.json");

// --- Helper: Load/Save JSON ---
function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
      return { lastNumber: data.lastNumber || 0, lastUserId: data.lastUserId || null };
    }
  } catch (err) {
    console.error("⚠️ Failed to load countData.json:", err);
  }
  return { lastNumber: 0, lastUserId: null };
}

function saveData() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ lastNumber, lastUserId }, null, 2));
  } catch (err) {
    console.error("⚠️ Failed to save countData.json:", err);
  }
}

// --- Load existing data ---
let { lastNumber, lastUserId } = loadData();

// --- On Ready ---
client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  client.user.setPresence({
    activities: [{ name: `Counting, rn at ${lastNumber}`, type: 3 }],
    status: "online",
  });
});

// --- Message Handler ---
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (message.channel.id !== COUNTING_CHANNEL_ID) return;

  const number = parseInt(message.content.trim());
  if (isNaN(number)) return;

  const expected = lastNumber + 1;

  // Invalid count
  if (number !== expected || message.author.id === lastUserId) {
    if (message._countHandled) return;
    message._countHandled = true;

    await message.channel.send(
      `❌ Count reset! <@${message.author.id}> messed it up! Back to **1**.`
    );

    try {
      const member = await message.guild.members.fetch(message.author.id);

      if (member.roles.cache.has(STRIKE_ROLE_ID)) {
        if (!member.roles.cache.has(BAN_ROLE_ID)) {
          await member.roles.add(BAN_ROLE_ID);
          await message.channel.send(
            `🚫 <@${member.id}> has been banned from counting!`
          );
        }
      } else {
        await member.roles.add(STRIKE_ROLE_ID);
        await message.channel.send(
          `⚠️ <@${member.id}> received a strike! One more and you're out.`
        );
      }
    } catch (err) {
      console.error("Role assignment error:", err);
    }

    // Reset
    lastNumber = 0;
    lastUserId = null;
    saveData(); // save to file

    client.user.setPresence({
      activities: [{ name: `Counting paused`, type: 3 }],
      status: "online",
    });

    return;
  }

  // ✅ Valid count
  lastNumber = number;
  lastUserId = message.author.id;
  saveData(); // save to file

  client.user.setPresence({
    activities: [{ name: `Counting, rn at ${lastNumber}`, type: 3 }],
    status: "online",
  });

  await message.react("✅");

  if (number % 50 === 0) {
    await message.channel.send(`🎉 Nice! The count reached **${number}**!`);
  }
});

// --- Bot Login ---
client.login(process.env.TOKEN).catch((err) => {
  console.error("❌ Failed to login:", err);
});

// --- Express Keepalive ---
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
