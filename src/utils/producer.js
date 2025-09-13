import amqp from "amqplib";

export async function publishToQueue(queue, message) {
  const connection = await amqp.connect(
    process.env.RABBITMQ_URL || "amqp://localhost"
  );
  const channel = await connection.createChannel();
  await channel.assertQueue(queue, { durable: true });
  channel.sendToQueue(queue, Buffer.from(message));
  await channel.close();
  await connection.close();
}

export async function requestPrediction(
  chatId,
  imageName,
  userId,
  predictionUid
) {
  const message = {
    chatId: chatId,
    imageName: imageName,
    user_id: userId,
    predictionUid, // Include UID in message
  };

  // Send to queue
  await publishToQueue("predictions", JSON.stringify(message));

  // Return UID immediately for polling
  return {
    status: "queued",
    predictionUid: predictionUid, // Frontend can start polling this UID
  };
}
