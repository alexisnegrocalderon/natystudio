import { holdPublicSlot } from "../../server/nataliaBookingApi";

export default function handler(req: any, res: any) {
  return holdPublicSlot(req, res);
}
