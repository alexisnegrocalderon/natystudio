import { listPublicSlots } from "../server/nataliaBookingApi";

export default function handler(req: any, res: any) {
  return listPublicSlots(req, res);
}
