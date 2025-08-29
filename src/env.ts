import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";


export const env = createEnv({
    server: {
        DISCORD_BOT_TOKEN: z.string().min(16),
        GUILD_ID: z.string().min(8),
        VOICE_CHANNEL_ID: z.string().min(8),
        APPLICATION_ID: z.string().min(8)
    },
    runtimeEnv: process.env,
    emptyStringAsUndefined: true
})