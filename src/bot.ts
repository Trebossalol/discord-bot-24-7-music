import { 
    ActivityType, 
    Client, 
    GatewayIntentBits, 
    REST, 
    Routes, 
    SlashCommandBuilder,
    CommandInteraction,
    Guild,
    VoiceChannel
} from 'discord.js';
import { 
    joinVoiceChannel, 
    createAudioPlayer, 
    createAudioResource, 
    AudioPlayerStatus, 
    VoiceConnectionStatus, 
    entersState,
    VoiceConnection,
    AudioPlayer,
    getVoiceConnection
} from '@discordjs/voice';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { env } from './env.js';
import ytdl from '@distube/ytdl-core';
import ytpl from 'ytpl';
import * as playdl from 'play-dl';

dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Bot modes
enum BotMode {
    LOCAL_FILES = 'local',
    YOUTUBE = 'youtube'
}

// Queue system for YouTube tracks
interface QueueItem {
    url: string;
    title: string;
    requester?: string;
}

class MusicBot {
    private client: Client;
    private player: AudioPlayer;
    private connection: VoiceConnection | null = null;
    private mode: BotMode = BotMode.LOCAL_FILES;
    private musicDir: string;
    private localTracks: string[] = [];
    private currentLocalIndex: number = 0;
    private youtubeQueue: QueueItem[] = [];
    private isPlaying: boolean = false;
    private guild: Guild | null = null;
    private voiceChannel: VoiceChannel | null = null;
    private reconnectAttempts: number = 0;
    private maxReconnectAttempts: number = 5;
    private reconnectDelay: number = 5000;

    constructor() {
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds, 
                GatewayIntentBits.GuildVoiceStates,
                GatewayIntentBits.GuildMessages
            ],
        });

        this.musicDir = path.join(__dirname, '../music');
        this.loadLocalTracks();
        this.player = createAudioPlayer();
        this.setupPlayerListeners();
        this.setupClientListeners();
    }

    private loadLocalTracks() {
        try {
            this.localTracks = fs.readdirSync(this.musicDir)
                .filter(file => file.endsWith('.mp3'));
            
            if (!this.localTracks.length) {
                console.warn('No MP3 files found in the music directory.');
            }
        } catch (error) {
            console.error('Error loading local tracks:', error);
            this.localTracks = [];
        }
    }

    private setupPlayerListeners() {
        this.player.on(AudioPlayerStatus.Idle, () => {
            if (this.mode === BotMode.LOCAL_FILES) {
                this.playNextLocal();
            } else if (this.mode === BotMode.YOUTUBE) {
                // Remove the finished track from queue
                if (this.youtubeQueue.length > 0) {
                    this.youtubeQueue.shift();
                }
                this.playNextYouTube();
            }
        });

        this.player.on('error', error => {
            console.error('Audio player error:', error);
            // Try to continue with next track
            if (this.mode === BotMode.LOCAL_FILES) {
                this.playNextLocal();
            } else if (this.mode === BotMode.YOUTUBE) {
                this.youtubeQueue.shift(); // Remove the problematic track
                this.playNextYouTube();
            }
        });
    }

    private setupClientListeners() {
        this.client.once('ready', async () => {
            if (!this.client.user) {
                console.log('Client user is not defined');
                return;
            }

            console.log(`Logged in as ${this.client.user.tag}`);
            
            // Register slash commands
            await this.registerCommands();
            
            // Connect to voice channel
            await this.connectToVoiceChannel();
        });

        // Handle voice state updates for auto-rejoin
        this.client.on('voiceStateUpdate', async (oldState, newState) => {
            // Check if the bot was disconnected
            if (oldState.member?.id === this.client.user?.id) {
                if (oldState.channel && !newState.channel) {
                    console.log('Bot was disconnected from voice channel, attempting to rejoin...');
                    await this.handleDisconnection();
                }
            }
        });

        // Handle interactions (slash commands)
        this.client.on('interactionCreate', async (interaction) => {
            if (!interaction.isCommand()) return;
            await this.handleCommand(interaction as CommandInteraction);
        });
    }

    private async registerCommands() {
        const commands = [
            new SlashCommandBuilder()
                .setName('mode')
                .setDescription('Switch between local files and YouTube mode')
                .addStringOption(option =>
                    option.setName('type')
                        .setDescription('The mode to switch to')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Local Files', value: 'local' },
                            { name: 'YouTube', value: 'youtube' }
                        )
                ),
            new SlashCommandBuilder()
                .setName('play')
                .setDescription('Play a YouTube song or playlist (YouTube mode only)')
                .addStringOption(option =>
                    option.setName('query')
                        .setDescription('YouTube URL or search query')
                        .setRequired(true)
                ),
            new SlashCommandBuilder()
                .setName('skip')
                .setDescription('Skip the current track'),
            new SlashCommandBuilder()
                .setName('queue')
                .setDescription('Show the current queue'),
            new SlashCommandBuilder()
                .setName('clear')
                .setDescription('Clear the YouTube queue'),
            new SlashCommandBuilder()
                .setName('nowplaying')
                .setDescription('Show what\'s currently playing'),
            new SlashCommandBuilder()
                .setName('rejoin')
                .setDescription('Force the bot to rejoin the voice channel')
        ];

        const rest = new REST({ version: '10' }).setToken(env.DISCORD_BOT_TOKEN);

        try {
            console.log('Started refreshing application (/) commands.');
            await rest.put(
                Routes.applicationGuildCommands(env.APPLICATION_ID, env.GUILD_ID),
                { body: commands.map(cmd => cmd.toJSON()) }
            );
            console.log('Successfully reloaded application (/) commands.');
        } catch (error) {
            console.error('Error registering commands:', error);
        }
    }

    private async connectToVoiceChannel(): Promise<boolean> {
        try {
            this.guild = await this.client.guilds.fetch(env.GUILD_ID);
            const channel = await this.guild.channels.fetch(env.VOICE_CHANNEL_ID);

            if (!channel || !channel.isVoiceBased()) {
                throw new Error(`Voice channel ${env.VOICE_CHANNEL_ID} not found`);
            }

            this.voiceChannel = channel as VoiceChannel;

            this.connection = joinVoiceChannel({
                channelId: this.voiceChannel.id,
                guildId: this.guild.id,
                adapterCreator: this.guild.voiceAdapterCreator,
                selfDeaf: false,
            });

            // Setup connection event listeners
            this.connection.on(VoiceConnectionStatus.Disconnected, async () => {
                try {
                    await Promise.race([
                        entersState(this.connection!, VoiceConnectionStatus.Signalling, 5_000),
                        entersState(this.connection!, VoiceConnectionStatus.Connecting, 5_000),
                    ]);
                    // Seems to be reconnecting
                } catch (error) {
                    // Seems to be a real disconnect
                    console.log('Voice connection lost, will attempt to reconnect...');
                    this.connection?.destroy();
                    this.connection = null;
                    await this.handleDisconnection();
                }
            });

            this.connection.on(VoiceConnectionStatus.Destroyed, () => {
                console.log('Voice connection destroyed');
                this.connection = null;
            });

            this.connection.subscribe(this.player);

            await entersState(this.connection, VoiceConnectionStatus.Ready, 30_000);
            console.log('Successfully connected to voice channel');
            
            // Start playing based on current mode
            if (this.mode === BotMode.LOCAL_FILES && this.localTracks.length > 0) {
                this.playNextLocal();
            }
            
            this.reconnectAttempts = 0; // Reset reconnect attempts on successful connection
            return true;
        } catch (error) {
            console.error('Failed to connect to voice channel:', error);
            return false;
        }
    }

    private async handleDisconnection() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('Max reconnection attempts reached. Giving up.');
            return;
        }

        this.reconnectAttempts++;
        console.log(`Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
        
        // Wait before attempting to reconnect
        await new Promise(resolve => setTimeout(resolve, this.reconnectDelay));
        
        const success = await this.connectToVoiceChannel();
        if (!success) {
            // Try again
            await this.handleDisconnection();
        }
    }

    private async handleCommand(interaction: CommandInteraction) {
        const commandName = interaction.commandName;

        switch (commandName) {
            case 'mode':
                await this.handleModeCommand(interaction);
                break;
            case 'play':
                await this.handlePlayCommand(interaction);
                break;
            case 'skip':
                await this.handleSkipCommand(interaction);
                break;
            case 'queue':
                await this.handleQueueCommand(interaction);
                break;
            case 'clear':
                await this.handleClearCommand(interaction);
                break;
            case 'nowplaying':
                await this.handleNowPlayingCommand(interaction);
                break;
            case 'rejoin':
                await this.handleRejoinCommand(interaction);
                break;
        }
    }

    private async handleModeCommand(interaction: CommandInteraction) {
        const newMode = interaction.options.get('type')?.value as BotMode;
        
        if (this.mode === newMode) {
            await interaction.reply(`Already in ${newMode} mode.`);
            return;
        }

        this.mode = newMode;
        this.player.stop(); // Stop current playback
        
        if (newMode === BotMode.LOCAL_FILES) {
            this.youtubeQueue = []; // Clear YouTube queue
            if (this.localTracks.length > 0) {
                this.playNextLocal();
                await interaction.reply('Switched to local files mode. Playing local MP3 files.');
            } else {
                await interaction.reply('Switched to local files mode, but no MP3 files found in the music directory.');
            }
        } else {
            await interaction.reply('Switched to YouTube mode. Use `/play` to add songs or playlists.');
        }
    }

    private async handlePlayCommand(interaction: CommandInteraction) {
        if (this.mode !== BotMode.YOUTUBE) {
            await interaction.reply('The bot is currently in local files mode. Use `/mode youtube` to switch to YouTube mode.');
            return;
        }

        await interaction.deferReply();
        
        const query = interaction.options.get('query')?.value as string;
        
        try {
            // Check if it's a playlist
            if (ytpl.validateID(query)) {
                const playlist = await ytpl(query);
                const tracks: QueueItem[] = playlist.items.map(item => ({
                    url: item.shortUrl,
                    title: item.title,
                    requester: interaction.user.username
                }));
                
                this.youtubeQueue.push(...tracks);
                await interaction.editReply(`Added ${tracks.length} tracks from playlist: ${playlist.title}`);
            } 
            // Check if it's a direct YouTube URL
            else if (query.includes('youtube.com') || query.includes('youtu.be')) {
                const info = await ytdl.getInfo(query);
                this.youtubeQueue.push({
                    url: query,
                    title: info.videoDetails.title,
                    requester: interaction.user.username
                });
                await interaction.editReply(`Added to queue: ${info.videoDetails.title}`);
            }
            // Otherwise, search for it
            else {
                const searchResults = await playdl.search(query, { limit: 1 });
                if (searchResults.length > 0) {
                    const video = searchResults[0];
                    this.youtubeQueue.push({
                        url: video.url,
                        title: video.title || 'Unknown Title',
                        requester: interaction.user.username
                    });
                    await interaction.editReply(`Added to queue: ${video.title}`);
                } else {
                    await interaction.editReply('No results found for your search query.');
                    return;
                }
            }
            
            // Start playing if not already playing
            if (!this.isPlaying && this.youtubeQueue.length > 0) {
                this.playNextYouTube();
            }
        } catch (error) {
            console.error('Error processing play command:', error);
            await interaction.editReply('An error occurred while processing your request.');
        }
    }

    private async handleSkipCommand(interaction: CommandInteraction) {
        if (this.mode === BotMode.LOCAL_FILES) {
            this.currentLocalIndex = (this.currentLocalIndex + 1) % this.localTracks.length;
        }
        this.player.stop();
        await interaction.reply('Skipped current track.');
    }

    private async handleQueueCommand(interaction: CommandInteraction) {
        if (this.mode === BotMode.LOCAL_FILES) {
            await interaction.reply(`Playing local files. Current: ${this.localTracks[this.currentLocalIndex] || 'None'}`);
        } else {
            if (this.youtubeQueue.length === 0) {
                await interaction.reply('The queue is empty.');
            } else {
                const queueList = this.youtubeQueue.slice(0, 10).map((track, index) => 
                    `${index + 1}. ${track.title} (requested by ${track.requester})`
                ).join('\n');
                
                const remaining = this.youtubeQueue.length > 10 ? `\n... and ${this.youtubeQueue.length - 10} more` : '';
                await interaction.reply(`**Current Queue:**\n${queueList}${remaining}`);
            }
        }
    }

    private async handleClearCommand(interaction: CommandInteraction) {
        if (this.mode !== BotMode.YOUTUBE) {
            await interaction.reply('Clear command only works in YouTube mode.');
            return;
        }
        
        this.youtubeQueue = [];
        this.player.stop();
        await interaction.reply('Queue cleared.');
    }

    private async handleNowPlayingCommand(interaction: CommandInteraction) {
        if (this.player.state.status !== AudioPlayerStatus.Playing) {
            await interaction.reply('Nothing is currently playing.');
            return;
        }

        if (this.mode === BotMode.LOCAL_FILES) {
            const currentTrack = this.localTracks[this.currentLocalIndex];
            await interaction.reply(`Now playing: ${currentTrack || 'Unknown'} (Local File)`);
        } else {
            const currentTrack = this.youtubeQueue[0];
            if (currentTrack) {
                await interaction.reply(`Now playing: ${currentTrack.title} (requested by ${currentTrack.requester})`);
            } else {
                await interaction.reply('Nothing is currently playing.');
            }
        }
    }

    private async handleRejoinCommand(interaction: CommandInteraction) {
        await interaction.deferReply();
        
        // Destroy existing connection if any
        if (this.connection) {
            this.connection.destroy();
            this.connection = null;
        }
        
        // Reset reconnect attempts
        this.reconnectAttempts = 0;
        
        // Try to reconnect
        const success = await this.connectToVoiceChannel();
        
        if (success) {
            await interaction.editReply('Successfully rejoined the voice channel.');
        } else {
            await interaction.editReply('Failed to rejoin the voice channel.');
        }
    }

    private playNextLocal() {
        if (this.localTracks.length === 0) {
            console.log('No local tracks to play');
            return;
        }

        const trackName = this.localTracks[this.currentLocalIndex];
        const resource = createAudioResource(path.join(this.musicDir, trackName));
        
        this.player.play(resource);
        this.isPlaying = true;
        
        if (this.client.user) {
            this.client.user.setActivity(trackName, { type: ActivityType.Listening });
        }
        
        // Move to next track for next play
        this.currentLocalIndex = (this.currentLocalIndex + 1) % this.localTracks.length;
    }

    private async playNextYouTube() {
        if (this.youtubeQueue.length === 0) {
            console.log('YouTube queue is empty');
            this.isPlaying = false;
            if (this.client.user) {
                this.client.user.setActivity('Waiting for songs...', { type: ActivityType.Watching });
            }
            return;
        }

        const track = this.youtubeQueue[0];
        
        try {
            const stream = ytdl(track.url, {
                filter: 'audioonly',
                quality: 'highestaudio',
                highWaterMark: 1 << 25
            });
            
            const resource = createAudioResource(stream);
            this.player.play(resource);
            this.isPlaying = true;
            
            if (this.client.user) {
                this.client.user.setActivity(track.title, { type: ActivityType.Listening });
            }
            
            console.log(`Now playing: ${track.title}`);
        } catch (error) {
            console.error('Error playing YouTube track:', error);
            this.youtubeQueue.shift(); // Remove the problematic track
            this.playNextYouTube(); // Try next track
        }
    }

    public async start() {
        await this.client.login(env.DISCORD_BOT_TOKEN);
    }
}

// Start the bot
const bot = new MusicBot();
bot.start().catch(console.error);