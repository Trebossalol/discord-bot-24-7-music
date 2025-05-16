import { Client, GatewayIntentBits } from 'discord.js';
import { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnectionStatus, entersState } from '@discordjs/voice';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { env } from './env.js';

dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
});

const musicDir = path.join(__dirname, '../music');
const tracks = fs.readdirSync(musicDir).filter(file => file.endsWith('.mp3'));

if (!tracks.length) {
    console.error('No MP3 files found in the music directory.');
    process.exit(1);
}

const player = createAudioPlayer();

function playNext(index = 0) {
    const resource = createAudioResource(path.join(musicDir, tracks[index]));
    player.play(resource);

    player.once(AudioPlayerStatus.Idle, () => {
        playNext((index + 1) % tracks.length); // loop
    });
}

client.once('ready', async () => {

    if (!client.user) {
        console.log('Client user is not defined')
        return
    }

    console.log(`Logged in as ${client.user.tag}`);

    const guild = await client.guilds.fetch(env.GUILD_ID);
    const channel = await guild.channels.fetch(env.VOICE_CHANNEL_ID);

    if (!channel) throw new Error(`Chanel ${env.VOICE_CHANNEL_ID} not found`)

    const connection = joinVoiceChannel({
        channelId: channel.id,
        guildId: guild.id,
        adapterCreator: guild.voiceAdapterCreator,
        selfDeaf: false,
    });

    connection.subscribe(player);

    try {
        await entersState(connection, VoiceConnectionStatus.Ready, 30_000);
        playNext();
    } catch (error) {
        console.error('Failed to connect or play:', error);
        connection.destroy();
    }
});

client.login(env.DISCORD_BOT_TOKEN);
