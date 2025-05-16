# Discord-Bot 24/7 Music

This bot joins a fixed voice channel and plays the music in the `music` folder 24/7.

## Adding Music

Just place your MP3 files into the music folder and restart the containers using the following command:

```sh
npm run docker:restart
```

## Deployment (Docker)

Ensure you have a `.env` file in the docker folder specifying the following variables:

| Environment Variable | Description                     |
| -------------------- | ------------------------------- |
| DISCORD_TOKEN        | Your Discord bot token          |
| GUILD_ID             | ID of your Discord server       |
| VOICE_CHANNEL_ID     | ID of the voice channel to join |

Now start the containers using:

```sh
npm run docker:deploy
```
