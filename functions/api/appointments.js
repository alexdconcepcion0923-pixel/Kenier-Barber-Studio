const ALLOWED_ORIGIN =
  "https://alexdconcepcion0923-pixel.github.io";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400"
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json; charset=UTF-8"
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
  try {
    const db = context.env.DB;

    const url = new URL(context.request.url);
    const date = url.searchParams.get("date");

    if (!date) {
      return jsonResponse(
        { error: "Falta la fecha" },
        400
      );
    }

    const result = await db.prepare(`
      SELECT
        id,
        appointment_date,
        appointment_time,
        client_name,
        client_phone,
        service,
        status,
        created_at
      FROM appointments
      WHERE appointment_date = ?
        AND status = 'confirmed'
      ORDER BY appointment_time ASC
    `)
    .bind(date)
    .all();

    return jsonResponse(result.results || []);
  } catch (error) {
    return jsonResponse(
      {
        error: "Error obteniendo las citas",
        details: error.message
      },
      500
    );
  }
}

export async function onRequestPost(context) {
  try {
    const db = context.env.DB;

    const data = await context.request.json();

    const appointmentDate = data.date;
    const appointmentTime = data.time;
    const clientName = data.name;
    const clientPhone = data.phone;
    const service = data.service;

    if (
      !appointmentDate ||
      !appointmentTime ||
      !clientName ||
      !clientPhone ||
      !service
    ) {
      return jsonResponse(
        {
          error: "Faltan datos para crear la cita"
        },
        400
      );
    }

    const result = await db.prepare(`
      INSERT INTO appointments (
        appointment_date,
        appointment_time,
        client_name,
        client_phone,
        service,
        status
      )
      VALUES (?, ?, ?, ?, ?, 'confirmed')
    `)
    .bind(
      appointmentDate,
      appointmentTime,
      clientName,
      clientPhone,
      service
    )
    .run();

    return jsonResponse({
      success: true,
      message: "Cita confirmada",
      id: result.meta.last_row_id
    });
  } catch (error) {
    if (
      error.message &&
      error.message.toLowerCase().includes("unique")
    ) {
      return jsonResponse(
        {
          error: "Ese horario acaba de ser reservado. Por favor selecciona otro."
        },
        409
      );
    }

    return jsonResponse(
      {
        error: "No se pudo crear la cita",
        details: error.message
      },
      500
    );
  }
}

export async function onRequestDelete(context) {
  try {
    const db = context.env.DB;

    const data = await context.request.json();
    const id = data.id;

    if (!id) {
      return jsonResponse(
        { error: "Falta el ID de la cita" },
        400
      );
    }

    const result = await db.prepare(`
      DELETE FROM appointments
      WHERE id = ?
    `)
    .bind(id)
    .run();

    if (!result.meta.changes) {
      return jsonResponse(
        { error: "La cita no existe" },
        404
      );
    }

    return jsonResponse({
      success: true,
      message: "Cita cancelada"
    });
  } catch (error) {
    return jsonResponse(
      {
        error: "No se pudo cancelar la cita",
        details: error.message
      },
      500
    );
  }
}
