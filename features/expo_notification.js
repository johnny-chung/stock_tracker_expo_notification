import { Expo } from "expo-server-sdk";
import "dotenv/config";
import { getCollection } from "../services/mongo.js";

// Expo SDK client
const expo = new Expo({ useFcmV1: true });

async function getAllStoredTokens() {
  const col = getCollection("expo_push_tokens");
  const docs = await col.find({}).toArray();
  return docs.map((d) => d.token).filter(Boolean);
}

async function removeToken(token) {
  try {
    const col = getCollection("user_push_tokens");
    await col.deleteOne({ token });
    console.log(`[push] Removed invalid token ${token}`);
  } catch (e) {
    console.error(`[push] Failed to remove token ${token}:`, e);
  }
}

export default async function sendExpoPushNotification(title, body, data) {
  const tokens = await getAllStoredTokens();
  if (!tokens.length) {
    console.warn("[push] No stored Expo tokens to send to.");
    return;
  }

  // Build messages for valid Expo tokens only
  const messages = [];
  const tokenOrder = [];
  for (const token of tokens) {
    if (!Expo.isExpoPushToken(token)) {
      console.warn(`[push] Invalid Expo token skipped: ${token}`);
      continue;
    }
    messages.push({
      to: token,
      sound: "default",
      title,
      body,
      data: { withSome: data },
      priority: "high",
    });
    tokenOrder.push(token);
  }

  if (!messages.length) {
    console.warn("[push] No valid messages to send.");
    return;
  }

  const chunks = expo.chunkPushNotifications(messages);
  const ticketIdToToken = new Map();
  let offset = 0;

  for (const chunk of chunks) {
    try {
      const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      // Map tickets to tokens using order within the chunk
      for (let i = 0; i < ticketChunk.length; i++) {
        const t = ticketChunk[i];
        const token = tokenOrder[offset + i];
        if (t.status === "ok" && t.id) {
          ticketIdToToken.set(t.id, token);
        } else if (t.status === "error") {
          const code = t?.details?.error;
          console.error(`[push] Ticket error for ${token}:`, t.message, code);
          if (code === "DeviceNotRegistered") {
            await removeToken(token);
          }
        }
      }
      offset += chunk.length;
    } catch (error) {
      console.error("[push] send chunk error:", error);
      offset += chunk.length;
    }
  }

  const receiptIds = Array.from(ticketIdToToken.keys());
  if (!receiptIds.length) return;

  const receiptChunks = expo.chunkPushNotificationReceiptIds(receiptIds);
  for (const rc of receiptChunks) {
    try {
      const receipts = await expo.getPushNotificationReceiptsAsync(rc);
      for (const [id, receipt] of Object.entries(receipts)) {
        if (receipt.status === "ok") continue;
        const token = ticketIdToToken.get(id);
        console.error(
          `[push] Receipt error for ${token}:`,
          receipt.message,
          receipt?.details?.error
        );
        if (receipt?.details?.error === "DeviceNotRegistered" && token) {
          await removeToken(token);
        }
      }
    } catch (error) {
      console.error("[push] get receipts error:", error);
    }
  }
}
