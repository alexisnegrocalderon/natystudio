import { createPublicBooking } from "../server/nataliaBookingApi";

export default function handler(req: any, res: any) {
  return createPublicBooking(req, res);
}
