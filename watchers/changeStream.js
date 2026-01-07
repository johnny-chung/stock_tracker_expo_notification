// Change stream watcher: listens to inserts/updates on target collections
// and triggers Expo push notifications with the changed document.
import { getCollection } from "../services/mongo.js";
import sendExpoPushNotification from "../features/expo_notification.js";

// Updated: do not watch 'bars' as requested; only watch 'signals' and 'events'.
const DEFAULT_COLLECTIONS = ["signals", "events"]; // inferred from models.py

function formatPushForCollection(collectionName, doc) {
  try {
    switch (collectionName) {
      case "bars": {
        const body = `${doc.ticker} ${doc.interval} @ ${new Date(
          doc.ts
        ).toISOString()} close=${doc.close}`;
        const data = { type: "bar", doc };
        return { title: "bar", body, data };
      }
      case "signals": {
        const title = `${doc.action}`;
        const body = `${doc.action} ${doc.ticker} @ ${doc.price} | ${
          doc.reason
        } |${new Date(doc.ts).toISOString()}`;
        const data = { type: "signal", doc };
        return { title, body, data };
      }
      case "events": {
        const body = `Event ${doc.type} for ${doc.ticker} ${
          doc.price
        } | ${new Date(doc.ts).toISOString()}`;
        const data = { type: "event", doc };
        return { title: "Event", body, data };
      }
      default: {
        const body = `Update in ${collectionName}`;
        const data = { type: collectionName, doc };
        return { title: "update", body, data };
      }
    }
  } catch (e) {
    return {
      title: "error",
      body: `Update in ${collectionName}`,
      data: { type: collectionName, doc },
    };
  }
}

async function watchCollection(collectionName) {
  const coll = getCollection(collectionName);

  const pipeline = [
    {
      $match: {
        operationType: { $in: ["insert", "update", "replace"] },
      },
    },
  ];

  const changeStream = coll.watch(pipeline, { fullDocument: "updateLookup" });
  console.log(`[watch] Watching '${collectionName}' for changes...`);

  changeStream.on("change", async (change) => {
    try {
      const fullDoc = change.fullDocument;
      if (!fullDoc) {
        console.warn(
          `[watch] No fullDocument for ${collectionName} change`,
          change
        );
        return;
      }

      const { title, body, data } = formatPushForCollection(collectionName, fullDoc);
      await sendExpoPushNotification(title, body, data);
    } catch (err) {
      console.error(
        `[watch] Error handling change for ${collectionName}:`,
        err
      );
    }
  });

  changeStream.on("error", (err) => {
    console.error(`[watch] Change stream error on '${collectionName}':`, err);
  });

  changeStream.on("close", () => {
    console.warn(`[watch] Change stream closed for '${collectionName}'.`);
  });

  return changeStream;
}

export async function startWatchers(collections = DEFAULT_COLLECTIONS) {
  const streams = [];
  for (const name of collections) {
    const s = await watchCollection(name);
    streams.push(s);
  }
  return streams;
}

export async function stopWatchers(streams) {
  if (!streams) return;
  for (const s of streams) {
    try {
      await s.close();
    } catch (e) {
      // ignore
    }
  }
}
