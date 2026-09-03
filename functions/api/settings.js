const ALLOWED_ORIGIN =
  "https://alexdconcepcion0923-pixel.github.io";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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


/*
==========================================================
OPTIONS
==========================================================
*/

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS
  });
}


/*
==========================================================
GET
Obtiene el horario de los 7 días
==========================================================
*/

export async function onRequestGet(context) {
  try {

    const db = context.env.DB;

    const result = await db.prepare(`
      SELECT
        day_of_week,
        is_available,
        open_time,
        close_time
      FROM business_hours
      ORDER BY day_of_week ASC
    `).all();

    return jsonResponse(
      result.results || []
    );

  } catch (error) {

    return jsonResponse(
      {
        error: "Error obteniendo los horarios",
        details: error.message
      },
      500
    );

  }
}


/*
==========================================================
POST
Actualiza el horario de un día
==========================================================

Ejemplo:

{
  "day_of_week": 2,
  "is_available": 0,
  "open_time": "08:00",
  "close_time": "19:00"
}

==========================================================
*/

export async function onRequestPost(context) {

  try {

    const db = context.env.DB;

    const data =
      await context.request.json();


    const dayOfWeek =
      Number(data.day_of_week);

    const isAvailable =
      Number(data.is_available);

    const openTime =
      data.open_time;

    const closeTime =
      data.close_time;


    /*
    ------------------------------------------------------
    Validar día
    ------------------------------------------------------
    */

    if (
      !Number.isInteger(dayOfWeek) ||
      dayOfWeek < 0 ||
      dayOfWeek > 6
    ) {

      return jsonResponse(
        {
          error: "Día de la semana inválido"
        },
        400
      );

    }


    /*
    ------------------------------------------------------
    Validar disponibilidad
    ------------------------------------------------------
    */

    if (
      isAvailable !== 0 &&
      isAvailable !== 1
    ) {

      return jsonResponse(
        {
          error: "El estado de disponibilidad es inválido"
        },
        400
      );

    }


    /*
    ------------------------------------------------------
    Si el día está disponible,
    validar horarios.
    ------------------------------------------------------
    */

    if (isAvailable === 1) {

      const timeRegex =
        /^([01]\d|2[0-3]):[0-5]\d$/;


      if (
        typeof openTime !== "string" ||
        typeof closeTime !== "string" ||
        !timeRegex.test(openTime) ||
        !timeRegex.test(closeTime)
      ) {

        return jsonResponse(
          {
            error: "Formato de hora inválido"
          },
          400
        );

      }


      /*
      Convertir las horas a minutos
      para comprobar que el cierre
      sea después de la apertura.
      */

      const [openHour, openMinute] =
        openTime.split(":").map(Number);

      const [closeHour, closeMinute] =
        closeTime.split(":").map(Number);


      const openMinutes =
        openHour * 60 + openMinute;

      const closeMinutes =
        closeHour * 60 + closeMinute;


      if (closeMinutes <= openMinutes) {

        return jsonResponse(
          {
            error:
              "La hora de cierre debe ser posterior a la hora de apertura"
          },
          400
        );

      }

    }


    /*
    ------------------------------------------------------
    Actualizar el día
    ------------------------------------------------------
    */

    const result = await db.prepare(`
      UPDATE business_hours
      SET
        is_available = ?,
        open_time = ?,
        close_time = ?
      WHERE day_of_week = ?
    `)
    .bind(
      isAvailable,
      openTime || "08:00",
      closeTime || "19:00",
      dayOfWeek
    )
    .run();


    /*
    ------------------------------------------------------
    Comprobar que realmente se actualizó
    ------------------------------------------------------
    */

    if (!result.meta.changes) {

      return jsonResponse(
        {
          error:
            "No se encontró ese día en la configuración"
        },
        404
      );

    }


    return jsonResponse({
      success: true,
      message: "Horario actualizado correctamente",
      day_of_week: dayOfWeek,
      is_available: isAvailable,
      open_time: openTime || "08:00",
      close_time: closeTime || "19:00"
    });


  } catch (error) {

    return jsonResponse(
      {
        error: "No se pudo actualizar el horario",
        details: error.message
      },
      500
    );

  }

}
