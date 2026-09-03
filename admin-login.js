export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const data = await request.json();

    if (data.password !== env.ADMIN_PASSWORD) {
      return Response.json(
        {
          success: false,
          error: "Contraseña incorrecta"
        },
        { status: 401 }
      );
    }

    return new Response(
      JSON.stringify({
        success: true
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Set-Cookie":
            "admin_auth=authenticated; Path=/; Secure; SameSite=Strict; Max-Age=86400"
        }
      }
    );

  } catch (error) {
    return Response.json(
      {
        success: false,
        error: error.message
      },
      { status: 500 }
    );
  }
}
