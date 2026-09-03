export async function onRequestGet(context) {
  const { env } = context;

  const db = env.DB;

  if (!db) {
    return Response.json(
      {
        error: "D1 no está conectado"
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
        SELECT
          id,
          appointment_date,
          appointment_time,
          client_name,
          client_phone,
          status
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
        error: "Error consultando D1",
        details: error.message
      },
      { status: 500 }
    );

  }
}


export async function onRequestPost(context) {
  const { request, env } = context;

  const db = env.DB;

  if (!db) {
    return Response.json(
      {
        error: "D1 no está conectado"
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


    await db
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
      success: true
    });


  } catch (error) {

    if (
      error.message &&
      error.message
        .toLowerCase()
        .includes("unique")
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


export async function onRequestDelete(context) {

  const { request, env } = context;

  const db = env.DB;

  if (!db) {

    return Response.json(
      {
        error: "D1 no está conectado"
      },
      { status: 500 }
    );

  }


  try {

    const data =
      await request.json();

    const id =
      data.id;


    if (!id) {

      return Response.json(
        {
          error: "Falta el ID de la cita"
        },
        { status: 400 }
      );

    }


    const result =
      await db
        .prepare(`
          UPDATE appointments
          SET status = 'cancelled'
          WHERE id = ?
        `)
        .bind(id)
        .run();


    if (
      !result.meta ||
      result.meta.changes === 0
    ) {

      return Response.json(
        {
          error: "La cita no existe"
        },
        { status: 404 }
      );

    }


    return Response.json({
      success: true,
      message: "Cita cancelada correctamente"
    });


  } catch (error) {

    return Response.json(
      {
        error: "No se pudo cancelar la cita",
        details: error.message
      },
      { status: 500 }
    );

  }

}
