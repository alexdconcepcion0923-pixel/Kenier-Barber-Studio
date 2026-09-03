export async function onRequestGet(context) {
  const { env } = context;
  const db = env["kenier-barber-db"];

  const url = new URL(context.request.url);
  const date = url.searchParams.get("date");

  if (!date) {
    return Response.json(
      { error: "Date is required" },
      { status: 400 }
    );
  }

  const result = await db
    .prepare(
      "SELECT appointment_time FROM appointments WHERE appointment_date = ? AND status = 'confirmed' ORDER BY appointment_time"
    )
    .bind(date)
    .all();

  return Response.json({
    appointments: result.results
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const db = env["kenier-barber-db"];

  try {
    const data = await request.json();

    const { date, time, name, phone } = data;

    if (!date || !time || !name || !phone) {
      return Response.json(
        { error: "Todos los campos son obligatorios" },
        { status: 400 }
      );
    }

    await db
      .prepare(
        `INSERT INTO appointments
        (appointment_date, appointment_time, client_name, client_phone)
        VALUES (?, ?, ?, ?)`
      )
      .bind(
        date,
        time,
        name.trim(),
        phone.trim()
      )
      .run();

    return Response.json({
      success: true
    });

  } catch (error) {
    if (error.message && error.message.includes("UNIQUE")) {
      return Response.json(
        { error: "Ese horario ya está reservado" },
        { status: 409 }
      );
    }

    return Response.json(
      { error: "No se pudo crear la cita" },
      { status: 500 }
    );
  }
}
