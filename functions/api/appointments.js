const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...CORS_HEADERS
    }
  });
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS
  });
}


export async function onRequestGet(context) {
  const { env } = context;
  const db = env.DB;

  if (!db) {
    return json({ error: "D1 no está conectado" }, 500);
  }

  const url = new URL(context.request.url);
  const date = url.searchParams.get("date");

  if (!date) {
    return json({ error: "Falta la fecha" }, 400);
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

    return json({
      appointments: result.results || []
    });

  } catch (error) {
    return json({
      error: "Error consultando D1",
      details: error.message
    }, 500);
  }
}


export async function onRequestPost(context) {
  const { request, env } = context;
  const db = env.DB;

  if (!db) {
    return json({ error: "D1 no está conectado" }, 500);
  }

  try {
    const data = await request.json();

    const date = data.date;
    const time = data.time;
    const name = data.name;
    const phone = data.phone;

    if (!date || !time || !name || !phone) {
      return json({
        error: "Todos los campos son obligatorios"
      }, 400);
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

    return json({
      success: true
    });

  } catch (error) {

    if (
      error.message &&
      error.message.toLowerCase().includes("unique")
    ) {
      return json({
        error: "Ese horario ya está reservado"
      }, 409);
    }

    return json({
      error: "No se pudo crear la cita",
      details: error.message
    }, 500);
  }
}


export async function onRequestDelete(context) {
  const { request, env } = context;
  const db = env.DB;

  if (!db) {
    return json({ error: "D1 no está conectado" }, 500);
  }

  try {
    const data = await request.json();
    const id = data.id;

    if (!id) {
      return json({
        error: "Falta el ID de la cita"
      }, 400);
    }

    const result = await db
      .prepare(`
        DELETE FROM appointments
        WHERE id = ?
      `)
      .bind(id)
      .run();

    if (
      !result.meta ||
      result.meta.changes === 0
    ) {
      return json({
        error: "La cita no existe"
      }, 404);
    }

    return json({
      success: true,
      message: "Cita cancelada correctamente"
    });

  } catch (error) {
    return json({
      error: "No se pudo cancelar la cita",
      details: error.message
    }, 500);
  }
}
