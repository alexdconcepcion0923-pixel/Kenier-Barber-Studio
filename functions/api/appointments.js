export async function onRequestGet(context) {
  const { env } = context;

  const db = env["kenier-barber-db"];

  if (!db) {
    return Response.json(
      {
        error: "D1 no está conectado a la Function"
      },
      { status: 500 }
    );
  }

  const url = new URL(context.request.url);
  const date = url.searchParams.get("date");

  if (!date) {
    return Response.json(
      {
        error: "Falta la fecha"
      },
      { status: 400 }
    );
  }

  try {
    const result = await db
      .prepare(`
        SELECT appointment_time
        FROM appointments
        WHERE appointment_date = ?
        AND status = 'confirmed'
        ORDER BY appointment_time
      `)
      .bind(date)
      .all();

    return Response.json({
      appointments: result.results || []
    });

  } catch (error) {

    return Response.json(
      {
        error: "Error consultando la base de datos",
        details: error.message
      },
      { status: 500 }
    );

  }
}


export async function onRequestPost(context) {
  const { request, env } = context;

  const db = env["kenier-barber-db"];

  if (!db) {
    return Response.json(
      {
        error: "D1 no está conectado a la Function"
      },
      { status: 500 }
    );
  }

  try {

    const data = await request.json();

    const date = data.date;
    const time = data.time;
    const name = data.name;
    const phone = data.phone;

    if (!date || !time || !name || !phone) {
      return Response.json(
        {
          error: "Todos los campos son obligatorios"
        },
        { status: 400 }
      );
    }

    const result = await db
      .prepare(`
        INSERT INTO appointments
        (
          appointment_date,
          appointment_time,
          client_name,
          client_phone,
          status
        )
        VALUES (?, ?, ?, ?, 'confirmed')
      `)
      .bind(
        date,
        time,
        name.trim(),
        phone.trim()
      )
      .run();

    return Response.json({
      success: true,
      id: result.meta?.last_row_id || null
    });

  } catch (error) {

    if (
      error.message &&
      error.message.toLowerCase().includes("unique")
    ) {
      return Response.json(
        {
          error: "Ese horario ya está reservado"
        },
        { status: 409 }
      );
    }

    return Response.json(
      {
        error: "No se pudo crear la cita",
        details: error.message
      },
      { status: 500 }
    );

  }
}
