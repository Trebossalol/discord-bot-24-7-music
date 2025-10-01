# Discord-Bot 24/7 Music

[![Docker Image CI](https://github.com/Trebossalol/discord-bot-24-7-music/actions/workflows/docker-image.yml/badge.svg)](https://github.com/Trebossalol/discord-bot-24-7-music/actions/workflows/docker-image.yml)

This bot joins a fixed voice channel and plays the music in the `music` folder 24/7.

## Installation (Build the docker image yourself)

1. Download the repository by clicking on `Code` -> `Download ZIP`

2. Create a `.env` file in the docker folder specifying the following variables:

| Environment Variable | Description                     |
| -------------------- | ------------------------------- |
| DISCORD_TOKEN        | Your Discord bot token          |
| GUILD_ID             | ID of your Discord server       |
| VOICE_CHANNEL_ID     | ID of the voice channel to join |

3. Start building the docker image and start a container of the image specified in the `compose.yaml`-file.
You may also specifiy multiple instances in the compose-file.

```sh
npm run docker:deploy
```

## Configuration

Inside the folder `music` you can place your mp3 files which the bot should play. 
The bot will start playing from top to bottom and then starts at the top again (loop)

If you added new tracks to the `music` folder and want the bot to reload them you can restart the docker containers using the following command.
```sh
npm run docker:restart
```
