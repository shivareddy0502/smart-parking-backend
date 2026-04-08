import prisma from './prisma';

/**
 * Sends a push notification to a specific user via Expo's Push API.
 * 
 * @param toUserId The ID of the recipient user
 * @param title Notification title
 * @param body Notification body
 * @param data Optional metadata for the notification
 */
export async function sendPush(
  toUserId: string,
  title: string,
  body: string,
  data: Record<string, string> = {}
) {
  try {
    // 1. Look up the stored push token for the target user
    const user = await prisma.user.findUnique({
      where: { id: toUserId },
      select: { pushToken: true }
    });

    if (!user || !user.pushToken) {
      console.log(`[Push] User ${toUserId} has no push token. Skipping.`);
      return; 
    }

    console.log(`[Push] Sending to ${toUserId}: ${title} - ${body}`);

    // 2. Fire and forget — communicate with Expo Push API
    // Note: In a production environment, you might use the 'expo-server-sdk' for better handling
    fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        to: user.pushToken, 
        title, 
        body, 
        data 
      }),
    })
    .then(async (res) => {
        const result = await res.json();
        console.log(`[Push] Expo Response:`, JSON.stringify(result));
    })
    .catch(err => {
        console.error(`[Push] Error sending to ${toUserId}:`, err);
    });

  } catch (error) {
    console.error(`[Push] Failed to prepare notification for ${toUserId}:`, error);
  }
}
