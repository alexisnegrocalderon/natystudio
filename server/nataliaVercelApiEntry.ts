import { handleNataliaVercelApi } from "./nataliaVercelApi";

export default function handler(req: any, res: any) {
  return handleNataliaVercelApi(req, res);
}
