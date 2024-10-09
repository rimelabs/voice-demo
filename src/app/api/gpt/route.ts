import { NextRequest, NextResponse } from "next/server";

async function handler(request: NextRequest) {
  const { text } = await request.json();

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content:
            "You are a customer service agent. Respond with no more than one paragraph at a time.",
        },
        { role: "user", content: text },
      ],
    }),
  });

  const data = await response.json();

  return NextResponse.json(data);
}

export async function GET(request: NextRequest) {
  return handler(request);
}

export async function POST(request: NextRequest) {
  return handler(request);
}
