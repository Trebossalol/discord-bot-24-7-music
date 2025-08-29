# Discord-Bot 24/7 Music

A versatile Discord bot that can play music 24/7 in a voice channel, supporting both local MP3 files and YouTube content.

## Features

- **Dual Mode Support**: Switch between local files and YouTube playback
- **Local File Playback**: Plays MP3 files from a local directory with continuous looping
- **YouTube Integration**: Play individual songs or entire playlists from YouTube
- **Slash Commands**: Modern Discord slash command interface
- **Auto-Rejoin**: Automatically reconnects to voice channel if disconnected
- **Queue Management**: Full queue system for YouTube tracks
- **Now Playing**: Display current track as bot status

## Slash Commands

- `/mode <type>` - Switch between 'local' and 'youtube' modes
- `/play <query>` - Play a YouTube song/playlist (URL or search query) - YouTube mode only
- `/skip` - Skip the current track
- `/queue` - Show the current queue
- `/clear` - Clear the YouTube queue
- `/nowplaying` - Show what's currently playing
- `/rejoin` - Force the bot to rejoin the voice channel

## Setup

### Prerequisites
1. Node.js and npm installed
2. A Discord bot token and application ID from the [Discord Developer Portal](https://discord.com/developers/applications)
3. MP3 files for local playback (optional)

### Installation

1. Clone the repository
2. Install dependencies:
   ```sh
   npm install
   ```

3. Add your MP3 files to the `music` folder (for local mode)

4. Create a `.env` file in the root directory with your Discord bot configuration:
   ```env
   DISCORD_BOT_TOKEN=your_bot_token
   APPLICATION_ID=your_application_id
   GUILD_ID=your_guild_id
   VOICE_CHANNEL_ID=your_voice_channel_id
   ```
   
   **Note**: The APPLICATION_ID is your bot's application ID, which you can find in the Discord Developer Portal.

5. Compile TypeScript:
   ```sh
   npm run compile
   ```

6. Start the bot:
   ```sh
   npm start
   ```

## Usage Examples

### Local Files Mode
```
/mode local
```
The bot will automatically start playing MP3 files from the music folder in a loop.

### YouTube Mode
```
/mode youtube
/play https://www.youtube.com/watch?v=dQw4w9WgXcQ
/play https://www.youtube.com/playlist?list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf
/play "lofi hip hop radio"
```

## Adding Music (Local Files)

Just place your MP3 files into the `music` folder and restart the bot:

```sh
npm run docker:restart
```

## Deployment (Docker)

Ensure you have a `.env` file in the docker folder specifying the following variables:

| Environment Variable | Description                     |
| -------------------- | ------------------------------- |
| DISCORD_BOT_TOKEN    | Your Discord bot token          |
| APPLICATION_ID       | Your bot's application ID       |
| GUILD_ID             | ID of your Discord server       |
| VOICE_CHANNEL_ID     | ID of the voice channel to join |

Now start the containers using:

```sh
npm run docker:deploy
```

To restart the containers (e.g., after adding new music):

```sh
npm run docker:restart
```

## Auto-Rejoin Feature

The bot will automatically attempt to rejoin the voice channel if it gets disconnected. It will:
- Try up to 5 times to reconnect
- Wait 5 seconds between reconnection attempts
- Reset the attempt counter on successful connection

You can also manually trigger a rejoin using the `/rejoin` command.

## Troubleshooting

### Bot doesn't respond to commands
- Make sure the APPLICATION_ID is set correctly in your `.env` file
- Ensure the bot has proper permissions in your Discord server
- Check that slash commands are registered (they should appear when typing `/` in Discord)

### YouTube playback issues
- Some videos may be age-restricted or region-locked
- Ensure you have a stable internet connection
- Check the console logs for specific error messages

### Local files not playing
- Verify MP3 files are in the `music` folder
- Check file permissions
- Ensure files are valid MP3 format

## License

This project is open source and available under the MIT License.