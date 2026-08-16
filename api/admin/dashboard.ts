import { nataliaAdminDashboard } from "../../server/nataliaAdminApi";

export default function handler(req: any, res: any) {
  return nataliaAdminDashboard(req, res);
}
