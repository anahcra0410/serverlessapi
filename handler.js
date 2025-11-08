import dotenv from 'dotenv';
import nodemailer from 'nodemailer';

dotenv.config();

const requiredFields = ['receiver_email', 'subject', 'body_text'];

/**
 * Serverless handler that sends an email using nodemailer.
 * @param {import('aws-lambda').APIGatewayProxyEventV2} event
 * @returns {Promise<import('aws-lambda').APIGatewayProxyResultV2>}
 */
export const sendEmail = async (event) => {
  console.info('[sendEmail] Incoming event:', JSON.stringify(event));

  try {
    const body = parseRequestBody(event.body);
    validatePayload(body);

    const smtpHost = process.env.SMTP_HOST || 'smtp.ethereal.email';
    const smtpPort = Number(process.env.SMTP_PORT ?? 587);
    const smtpSecure = process.env.SMTP_SECURE ? process.env.SMTP_SECURE.toLowerCase() === 'true' : false;

    console.info('[sendEmail] Using SMTP config host=%s port=%d secure=%s', smtpHost, smtpPort, smtpSecure);

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth: {
        user: process.env.SENDER_EMAIL,
        pass: process.env.SENDER_PASSWORD
      }
    });

    console.info('[sendEmail] Sending mail from %s to %s', process.env.SENDER_EMAIL, body.receiver_email);

    await transporter.sendMail({
      from: process.env.SENDER_EMAIL,
      to: body.receiver_email,
      subject: body.subject,
      text: body.body_text
    });

    console.info('[sendEmail] Email successfully sent.');

    return createResponse(200, {
      message: 'Email sent successfully.'
    });
  } catch (error) {
    console.error('[sendEmail] Error:', error);

    if (error.statusCode && error.body) {
      return error;
    }

    return createResponse(500, {
      message: 'Internal server error.',
      detail: error.message ?? 'Unknown error'
    });
  }
};

/**
 * Parse the incoming request body safely.
 * @param {string | null} body
 */
function parseRequestBody(body) {
  if (!body) {
    throw createResponse(400, {
      message: 'Request body is required.'
    });
  }

  try {
    return typeof body === 'string' ? JSON.parse(body) : body;
  } catch (err) {
    console.warn('[parseRequestBody] Invalid JSON body:', body);
    throw createResponse(400, {
      message: 'Invalid JSON payload.',
      detail: err.message
    });
  }
}

/**
 * Ensure the payload contains required fields.
 * @param {Record<string, any>} payload
 */
function validatePayload(payload) {
  const missing = requiredFields.filter((field) => !payload?.[field]);

  if (missing.length > 0) {
    console.warn('[validatePayload] Missing fields:', missing);
    throw createResponse(400, {
      message: 'Missing required fields.',
      missingFields: missing
    });
  }

  if (!process.env.SENDER_EMAIL || !process.env.SENDER_PASSWORD) {
    console.error('[validatePayload] Environment variables missing.');
    throw createResponse(500, {
      message: 'Email sender credentials are not configured.'
    });
  }
}

/**
 * Utility to build HTTP responses.
 * @param {number} statusCode
 * @param {Record<string, any>} payload
 */
function createResponse(statusCode, payload) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  };
}

