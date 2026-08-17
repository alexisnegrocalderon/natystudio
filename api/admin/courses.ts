import { addNataliaCourse } from "../../server/nataliaAdminApi";

export default function handler(req: any, res: any) {
  return addNataliaCourse(req, res);
}
