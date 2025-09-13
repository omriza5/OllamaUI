import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: { uid: string } }
) {
  try {
    const { uid } = params;

    // Proxy the request to YoloService
    const baseUrl =
      process.env.ENV !== "development"
        ? process.env.YOLO_SERVICE_URL
        : process.env.YOLO_SERVICE_DEV;
    const yoloServiceUrl = `http://${baseUrl}/prediction/${uid}`;

    const response = await fetch(yoloServiceUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch prediction from YoloService" },
        { status: response.status }
      );
    }

    const data = await response.json();

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error proxying request to YoloService:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
