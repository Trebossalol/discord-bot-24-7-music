import { ActivityType, Client, GatewayIntentBits } from 'discord.js';
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

type Mode = 'local' | 'youtube';
let mode: Mode = 'local';
let youtubeQueue: string[] = [];
let currentIndex = 0;

// Voice connection will be set after ready
let connection: ReturnType<typeof joinVoiceChannel> | undefined;

const musicDir = path.join(__dirname, '../music');
const tracks = fs.readdirSync(musicDir).filter(file => file.endsWith('.mp3'));

if (!tracks.length) {
    console.error('No MP3 files found in the music directory.');
    process.exit(1);
}

const player = createAudioPlayer();

function playNext(index = 0) {
    currentIndex = index;
    if (mode === 'local') {
        const trackName = tracks[index];
        const resource = createAudioResource(path.join(musicDir, trackName));
        player.play(resource);
        client.user?.setActivity(trackName, { type: ActivityType.Listening });
        player.once(AudioPlayerStatus.Idle, () => {
            playNext((index + 1) % tracks.length);
        });
    } else if (mode === 'youtube') {
        (async () => {
            if (!youtubeQueue.length) {
                console.warn('YouTube queue is empty.');
                return;
            }
            const url = youtubeQueue[index];
            const playdl = (await import('play-dl')).default;
            const streamInfo = await playdl.stream(url, { quality: 2 });
            const resource = createAudioResource(streamInfo.stream, { inputType: streamInfo.type });
            player.play(resource);
            client.user?.setActivity('YouTube', { type: ActivityType.Listening });
            player.once(AudioPlayerStatus.Idle, () => {
                playNext((index + 1) % youtubeQueue.length);
            });
        })().catch(err => console.error('Failed to play YouTube stream', err));
    }
}

function setupReconnection(guildId: string, channelId: string, adapterCreator: any) {
    if (!connection) return;
    connection.on(VoiceConnectionStatus.Disconnected, async () => {
        console.log('Disconnected from voice channel, attempting to rejoin...');
        try {
            connection?.destroy();
        } catch {}
        connection = joinVoiceChannel({
            channelId,
            guildId,
            adapterCreator,
            selfDeaf: false,
        });
        connection.subscribe(player);
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

    connection = joinVoiceChannel({
        channelId: channel.id,
        guildId: guild.id,
        adapterCreator: guild.voiceAdapterCreator,
        selfDeaf: false,
    });

    connection.subscribe(player);

    setupReconnection(guild.id, channel.id, guild.voiceAdapterCreator);

    try {
        await entersState(connection, VoiceConnectionStatus.Ready, 30_000);
        playNext();
    } catch (error) {
        console.error('Failed to connect or play:', error);
        connection.destroy();
    }

    // Register slash command
    await guild.commands.set([
        {
            name: 'mode',
            description: 'Switch playback mode',
            type: 1, // CHAT_INPUT
            options: [
                {
                    name: 'type',
                    description: 'Mode type',
                    type: 3, // STRING
                    required: true,
                    choices: [
                        { name: 'local', value: 'local' },
                        { name: 'youtube', value: 'youtube' },
                    ],
                },
                {
                    name: 'url',
                    description: 'YouTube URL (required for youtube mode)',
                    type: 3, // STRING
                    required: false,
                },
            ],
        },
    ]);
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName !== 'mode') return;

    const type = interaction.options.getString('type', true) as Mode;
    if (type === 'local') {
        mode = 'local';
        player.stop();
        playNext(0);
        await interaction.reply({ content: 'Switched to local music mode.', ephemeral: true });
    } else {
        const url = interaction.options.getString('url');
        if (!url) {
            await interaction.reply({ content: 'Please provide a YouTube URL.', ephemeral: true });
            return;
        }
        mode = 'youtube';
        const playdl = (await import('play-dl')).default;
        try {
            if (playdl.yt_validate(url) === 'playlist') {
                const playlist = await playdl.playlist_info(url, { incomplete: true });
                youtubeQueue = playlist.videos.map(v => `https://www.youtube.com/watch?v=${v.id}`);
            } else {
                youtubeQueue = [url];
            }
            player.stop();
            playNext(0);
            await interaction.reply({ content: 'Switched to YouTube mode and started playback.', ephemeral: true });
        } catch (err) {
            console.error(err);
            await interaction.reply({ content: 'Failed to load YouTube resource.', ephemeral: true });
        }
    }
});

client.login(env.DISCORD_BOT_TOKEN);
