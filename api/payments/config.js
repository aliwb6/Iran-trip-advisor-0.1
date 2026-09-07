import {
  getPaymentEnvironment,
  publicPaymentConfig,
  sendJson,
} from '../../server/payments.js';

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return sendJson(response, 405, { error: 'method_not_allowed' });
  }

  return sendJson(response, 200, publicPaymentConfig(getPaymentEnvironment()));
}
