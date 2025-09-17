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

export async function publishToExchange(exchangeName, routingKey, message) {
  const connection = await amqp.connect(
    process.env.RABBITMQ_URL || "amqp://localhost"
  );
  const channel = await connection.createChannel();

  // Declare the exchange
  await channel.assertExchange(exchangeName, "direct", { durable: true });

  // Publish to exchange with routing key
  channel.publish(exchangeName, routingKey, Buffer.from(message));

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

  try {
    // Send to queue
    await publishToExchange(
      "YoloAppUserEvents",
      "predictions",
      JSON.stringify(message)
    );

    await publishToExchange(
      "YoloAppUserEvents",
      "analytics",
      JSON.stringify({
        publish_event: "analytics_event",
        event: "new_prediction_ANALYTICS",
        chatId: chatId,
        imageName: imageName,
        user_id: userId,
        predictionUid: predictionUid,
      })
    );

    await publishToExchange(
      "YoloBroadcast",
      "billing",
      JSON.stringify({
        publish_event: "billing_event",
        event: "new_prediction_BILLING",
        chatId: chatId,
        imageName: imageName,
        user_id: userId,
        predictionUid: predictionUid,
      })
    );

    // Return UID immediately for polling
    return {
      status: "queued",
      predictionUid: predictionUid, // Frontend can start polling this UID
    };
  } catch (error) {
    console.error("Error publishing to exchange:", error);
  }
}
