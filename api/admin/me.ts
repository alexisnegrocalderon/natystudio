import { nataliaAdminMe } from "../../server/nataliaAdminApi";

export default function handler(req: any, res: any) {
  return nataliaAdminMe(req, res);
}
