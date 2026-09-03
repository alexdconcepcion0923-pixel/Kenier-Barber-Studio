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
OBTENER HORA ACTUAL DE CUBA
==========================================================
*/

function getCubaDateTime() {

  const formatter = new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone: "America/Havana",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }
  );

  const parts =
    formatter.formatToParts(new Date());

  const values = {};

  parts.forEach(part => {

    if (part.type !== "literal") {
      values[part.type] = part.value;
    }

  });

  return {
    date:
      `${values.year}-${values.month}-${values.day}`,

    hour:
      Number(values.hour),

    minute:
      Number(values.minute)
  };
}


/*
==========================================================
OBTENER DÍA DE LA SEMANA EN CUBA
==========================================================
*/

function getCubaDayOfWeek(dateString) {

  /*
    Usamos UTC al mediodía para evitar problemas
    de cambio de día por zona horaria.
  */

  const date =
    new Date(dateString + "T12:00:00Z");

  return date.getUTCDay();
}


/*
==========================================================
CONVERTIR HH:MM A MINUTOS
==========================================================
*/

function timeToMinutes(time) {

  const [hour, minute] =
    time.split(":").map(Number);

  return hour * 60 + minute;
}


/*
==========================================================
VALIDAR HORARIO DEL NEGOCIO
==========================================================
*/

async function validateBusinessHours(
  db,
  appointmentDate,
  appointmentTime
) {

  const dayOfWeek =
    getCubaDayOfWeek(appointmentDate);


  const result =
    await db.prepare(`
      SELECT
        day_of_week,
        is_available,
        open_time,
        close_time
      FROM business_hours
      WHERE day_of_week = ?
    `)
    .bind(dayOfWeek)
    .first();


  /*
    Si no existe configuración para ese día,
    no permitimos reservas.
  */

  if (!result) {

    return {
      valid: false,
      error:
        "No hay un horario configurado para ese día."
    };

  }


  /*
    Día cerrado.
  */

  if (Number(result.is_available) !== 1) {

    return {
      valid: false,
      error:
        "Kenier Barber Studio no está disponible ese día."
    };

  }


  const appointmentMinutes =
    timeToMinutes(appointmentTime);

  const openMinutes =
    timeToMinutes(result.open_time);

  const closeMinutes =
    timeToMinutes(result.close_time);


  /*
    La cita debe comenzar dentro
    del horario de trabajo.

    Como las citas duran 1 hora,
    también comprobamos que la cita
    termine antes del cierre.
  */

  if (
    appointmentMinutes < openMinutes ||
    appointmentMinutes + 60 > closeMinutes
  ) {

    return {
      valid: false,
      error:
        "Ese horario está fuera del horario de trabajo."
    };

  }


  /*
    Si la fecha es hoy en Cuba,
    comprobar que la hora todavía no haya pasado.
  */

  const cubaNow =
    getCubaDateTime();


  if (appointmentDate === cubaNow.date) {

    const currentMinutes =
      cubaNow.hour * 60 + cubaNow.minute;


    if (appointmentMinutes <= currentMinutes) {

      return {
        valid: false,
        error:
          "Ese horario ya pasó. Selecciona otro."
      };

    }

  }


  /*
    No permitir fechas anteriores.
  */

  if (appointmentDate < cubaNow.date) {

    return {
      valid: false,
      error:
        "No puedes reservar una cita para una fecha pasada."
    };

  }


  return {
    valid: true,
    dayOfWeek,
    openTime: result.open_time,
    closeTime: result.close_time
  };
}


/*
==========================================================
GET
OBTENER CITAS DE UNA FECHA
==========================================================
*/

export async function onRequestGet(context) {

  try {

    const db =
      context.env.DB;

    const url =
      new URL(context.request.url);

    const date =
      url.searchParams.get("date");


    if (!date) {

      return jsonResponse(
        {
          error: "Falta la fecha"
        },
        400
      );

    }


    const result =
      await db.prepare(`
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


    return jsonResponse(
      result.results || []
    );


  } catch (error) {

    return jsonResponse(
      {
        error:
          "Error obteniendo las citas",
        details:
          error.message
      },
      500
    );

  }

}


/*
==========================================================
POST
CREAR CITA
==========================================================
*/

export async function onRequestPost(context) {

  try {

    const db =
      context.env.DB;


    const data =
      await context.request.json();


    const appointmentDate =
      data.date;

    const appointmentTime =
      data.time;

    const clientName =
      data.name;

    const clientPhone =
      data.phone;

    const service =
      data.service;


    /*
    ------------------------------------------------------
    Validar datos básicos
    ------------------------------------------------------
    */

    if (
      !appointmentDate ||
      !appointmentTime ||
      !clientName ||
      !clientPhone ||
      !service
    ) {

      return jsonResponse(
        {
          error:
            "Faltan datos para crear la cita"
        },
        400
      );

    }


    /*
    ------------------------------------------------------
    Validar formato de fecha
    ------------------------------------------------------
    */

    const dateRegex =
      /^\d{4}-\d{2}-\d{2}$/;

    if (!dateRegex.test(appointmentDate)) {

      return jsonResponse(
        {
          error:
            "Formato de fecha inválido"
        },
        400
      );

    }


    /*
    ------------------------------------------------------
    Validar formato de hora
    ------------------------------------------------------
    */

    const timeRegex =
      /^([01]\d|2[0-3]):[0-5]\d$/;

    if (!timeRegex.test(appointmentTime)) {

      return jsonResponse(
        {
          error:
            "Formato de hora inválido"
        },
        400
      );

    }


    /*
    ------------------------------------------------------
    VALIDAR HORARIO DE NEGOCIO
    ------------------------------------------------------
    */

    const scheduleCheck =
      await validateBusinessHours(
        db,
        appointmentDate,
        appointmentTime
      );


    if (!scheduleCheck.valid) {

      return jsonResponse(
        {
          error:
            scheduleCheck.error
        },
        400
      );

    }


    /*
    ------------------------------------------------------
    CREAR CITA
    ------------------------------------------------------
    */

    const result =
      await db.prepare(`
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

      message:
        "Cita confirmada",

      id:
        result.meta.last_row_id

    });


  } catch (error) {


    /*
    ------------------------------------------------------
    HORARIO OCUPADO
    ------------------------------------------------------
    */

    if (
      error.message &&
      error.message
        .toLowerCase()
        .includes("unique")
    ) {

      return jsonResponse(
        {
          error:
            "Ese horario acaba de ser reservado. Por favor selecciona otro."
        },
        409
      );

    }


    return jsonResponse(
      {
        error:
          "No se pudo crear la cita",

        details:
          error.message
      },
      500
    );

  }

}


/*
==========================================================
DELETE
CANCELAR CITA
==========================================================
*/

export async function onRequestDelete(context) {

  try {

    const db =
      context.env.DB;


    const data =
      await context.request.json();


    const id =
      data.id;


    if (!id) {

      return jsonResponse(
        {
          error:
            "Falta el ID de la cita"
        },
        400
      );

    }


    const result =
      await db.prepare(`
        DELETE FROM appointments
        WHERE id = ?
      `)
      .bind(id)
      .run();


    if (!result.meta.changes) {

      return jsonResponse(
        {
          error:
            "La cita no existe"
        },
        404
      );

    }


    return jsonResponse({

      success: true,

      message:
        "Cita cancelada"

    });


  } catch (error) {

    return jsonResponse(
      {
        error:
          "No se pudo cancelar la cita",

        details:
          error.message
      },
      500
    );

  }

}
