import { loginNataliaAdmin } from "../../server/nataliaAdminApi";

export default function handler(req: any, res: any) {
  return loginNataliaAdmin(req, res);
}
