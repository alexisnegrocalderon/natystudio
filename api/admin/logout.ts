import { logoutNataliaAdmin } from "../../server/nataliaAdminApi";

export default function handler(req: any, res: any) {
  return logoutNataliaAdmin(req, res);
}
