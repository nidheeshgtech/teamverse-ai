import "server-only";
import { AccessToken, TrackSource } from "livekit-server-sdk";

export type LiveKitConfig = { url: string; apiKey: string; apiSecret: string };

/** LiveKit settings from the server environment. The API secret never leaves the server. */
export function getLiveKitConfig(): LiveKitConfig | null {
  const url = process.env.LIVEKIT_URL;
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  return url && apiKey && apiSecret ? { url, apiKey, apiSecret } : null;
}

export const isLiveKitConfigured = () => getLiveKitConfig() !== null;

/** Seconds a join token is valid; joining must happen within this window (the session can outlive it). */
export const CALL_TOKEN_TTL = 10 * 60;

/** Short-lived token for one person in one call room: audio, video and screen share, no data channel. */
export async function mintCallToken(config: LiveKitConfig, room: string, identity: string, name: string): Promise<string> {
  const token = new AccessToken(config.apiKey, config.apiSecret, { identity, name, ttl: CALL_TOKEN_TTL });
  token.addGrant({
    room,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: false,
    canPublishSources: [TrackSource.MICROPHONE, TrackSource.CAMERA, TrackSource.SCREEN_SHARE, TrackSource.SCREEN_SHARE_AUDIO],
  });
  return token.toJwt();
}
