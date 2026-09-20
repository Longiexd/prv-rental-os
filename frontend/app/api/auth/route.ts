import { NextResponse } from "next/server";

const SESSION_COOKIE = "klynx_session";
const SESSION_VALUE = "demo-admin-session";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, password } = body;

    // Temporary demo authentication.
    // Later this can be replaced by the FastAPI/Odoo authentication flow.
    if (username !== "admin" || password !== "admin") {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid username or password",
        },
        {
          status: 401,
        }
      );
    }

    const response = NextResponse.json({
      success: true,
      message: "Login successful",
      user: {
        username: "admin",
        role: "Administrator",
      },
    });

    response.cookies.set(SESSION_COOKIE, SESSION_VALUE, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 8,
    });

    return response;
  } catch {
    return NextResponse.json(
      {
        success: false,
        message: "Invalid request",
      },
      {
        status: 400,
      }
    );
  }
}

export async function DELETE() {
  const response = NextResponse.json({
    success: true,
    message: "Logged out",
  });

  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return response;
}