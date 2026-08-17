import { getNataliaPaymentConnection, startNataliaPaymentConnection } from "../../../server/nataliaAdminApi";

export default function handler(req: any, res: any) {
  return req.method === "GET" ? getNataliaPaymentConnection(req, res) : startNataliaPaymentConnection(req, res);
}
