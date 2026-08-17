import { addNataliaAvailability } from "../../server/nataliaAdminApi";

export default function handler(req: any, res: any) {
  return addNataliaAvailability(req, res);
}
