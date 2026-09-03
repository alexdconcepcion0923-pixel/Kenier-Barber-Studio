export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const data = await request.json();
    const password = data.password;

    if (!password) {
      return Response.json(
        { error: "Falta la contraseña" },
        { status: 400 }
      );
    }

    if (password !== env.ADMIN_PASSWORD) {
      return Response.json(
        { error: "Contraseña incorrecta" },
        { status: 401 }
      );
    }

    const headers = new Headers();

    headers.append(
      "Set-Cookie",
      "admin_auth=authenticated; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=86400"
    );

    return new Response(
      JSON.stringify({ success: true }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Set-Cookie": headers.get("Set-Cookie")
        }
      }
    );

  } catch (error) {
    return Response.json(
      { error: "Error procesando login" },
      { status: 500 }
    );
  }
}
