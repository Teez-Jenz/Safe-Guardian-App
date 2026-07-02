import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE_NAME = "safe_guardian_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

type SessionPayload = {
  userId: string;
  name: string;
  email: string;
  phoneNumber: string;
  createdAt: string;
};

type SessionRequestBody = {
  userId: number | string;
  name?: string;
  email?: string;
  phoneNumber: string;
};

const parseSessionPayload = (rawCookieValue: string): SessionPayload | null => {
  try {
    const parsedCookie: unknown = JSON.parse(rawCookieValue);

    if (!parsedCookie || typeof parsedCookie !== "object") {
      return null;
    }

    const cookieObject = parsedCookie as Record<string, unknown>;
    const { userId, name, email, phoneNumber, createdAt } = cookieObject;

    if (
      typeof userId !== "string" ||
      typeof name !== "string" ||
      typeof email !== "string" ||
      typeof phoneNumber !== "string" ||
      typeof createdAt !== "string"
    ) {
      return null;
    }

    return {
      userId,
      name,
      email,
      phoneNumber,
      createdAt,
    };
  } catch {
    return null;
  }
};

export async function POST(request: NextRequest) {
  const requestBody: unknown = await request.json().catch(() => null);

  if (!requestBody || typeof requestBody !== "object") {
    return NextResponse.json(
      { error: "Invalid session payload." },
      { status: 400 },
    );
  }

  const { userId, name, email, phoneNumber } =
    requestBody as SessionRequestBody;

  if (
    (typeof userId !== "string" && typeof userId !== "number") ||
    typeof phoneNumber !== "string" ||
    !phoneNumber.trim()
  ) {
    return NextResponse.json(
      { error: "Required session fields are missing." },
      { status: 400 },
    );
  }

  const sessionPayload: SessionPayload = {
    userId: String(userId),
    name: name?.trim() ?? "",
    email: email?.trim() ?? "",
    phoneNumber: phoneNumber.trim(),
    createdAt: new Date().toISOString(),
  };

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, JSON.stringify(sessionPayload), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  return NextResponse.json({ session: sessionPayload });
}

export async function GET() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);

  if (!sessionCookie?.value) {
    return NextResponse.json({ session: null }, { status: 401 });
  }

  const sessionPayload = parseSessionPayload(sessionCookie.value);

  if (!sessionPayload) {
    cookieStore.delete(SESSION_COOKIE_NAME);
    return NextResponse.json({ session: null }, { status: 401 });
  }

  return NextResponse.json({ session: sessionPayload });
}

export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
  return NextResponse.json({ success: true });
}
