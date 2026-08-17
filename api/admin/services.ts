import { saveNataliaService } from "../../server/nataliaAdminApi";

export default function handler(req: any, res: any) {
  return saveNataliaService(req, res);
}
